# UpvShop — Tienda Online con Microservicios

Aplicación de e-commerce construida con arquitectura de microservicios usando FastAPI, PostgreSQL, Docker y Kubernetes.

## Arquitectura

| Servicio          | Puerto local | Descripción                          |
|-------------------|-------------|--------------------------------------|
| users-service     | 8001        | Registro, login JWT, perfil          |
| catalog-service   | 8002        | Productos, categorías, búsqueda      |
| cart-service      | 8003        | Carrito de compras                   |
| order-service     | 8004        | Creación y gestión de órdenes        |
| payment-service   | 8005        | Procesamiento de pagos (simulado)    |
| PostgreSQL        | 5432        | Base de datos compartida             |

---

## Requisitos previos

- [Docker Desktop](https://www.docker.com/products/docker-desktop/) instalado
- [Git](https://git-scm.com/) instalado
- Cuenta en [GitHub](https://github.com) (con Student Pack activado)
- Cuenta en [Docker Hub](https://hub.docker.com) (gratis)

---

## 1. Levantar el proyecto localmente

```bash
# Clonar el repositorio
git clone https://github.com/TU_USUARIO/upvshop.git
cd upvshop

# Levantar todos los servicios
docker-compose up --build

# En segundo plano
docker-compose up --build -d
```

Los servicios estarán disponibles en:
- http://localhost:8001/docs  → Users Service (Swagger UI)
- http://localhost:8002/docs  → Catalog Service
- http://localhost:8003/docs  → Cart Service
- http://localhost:8004/docs  → Order Service
- http://localhost:8005/docs  → Payment Service

---

## 2. Probar la API (flujo completo)

### Registrar usuario
```bash
curl -X POST http://localhost:8001/register \
  -H "Content-Type: application/json" \
  -d '{"name":"Juan Pérez","email":"juan@upv.edu.mx","password":"miPassword123"}'
```

### Iniciar sesión (guarda el token)
```bash
curl -X POST http://localhost:8001/login \
  -d "username=juan@upv.edu.mx&password=miPassword123" \
  -H "Content-Type: application/x-www-form-urlencoded"
```

### Ver productos
```bash
curl http://localhost:8002/products
```

### Agregar al carrito (requiere token)
```bash
curl -X POST http://localhost:8003/cart/items \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"product_id":1,"quantity":2}'
```

### Crear orden
```bash
curl -X POST http://localhost:8004/orders \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"items":[{"product_id":1,"quantity":1}]}'
```

### Procesar pago
```bash
curl -X POST http://localhost:8005/payments/process \
  -H "Authorization: Bearer TU_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{"order_id":1,"method":"card"}'
```

---

## 3. Crear usuario administrador

Conéctate a la base de datos y ejecuta:

```bash
docker exec -it upvshop-db psql -U admin -d upvshop -c \
  "UPDATE users SET role='admin' WHERE email='juan@upv.edu.mx';"
```

---

## 4. Deploy en Kubernetes (DigitalOcean DOKS)

### Requisitos previos
- Cuenta en DigitalOcean con crédito del Student Pack ($200)
- `doctl` instalado: https://docs.digitalocean.com/reference/doctl/how-to/install/
- `kubectl` instalado

### Pasos

```bash
# 1. Autenticarse en DigitalOcean
doctl auth init

# 2. Crear cluster Kubernetes (1 nodo básico para empezar)
doctl kubernetes cluster create upvshop-cluster \
  --region nyc1 \
  --node-pool "name=worker-pool;size=s-2vcpu-4gb;count=2"

# 3. Obtener credenciales del cluster
doctl kubernetes cluster kubeconfig save upvshop-cluster

# 4. Verificar conexión
kubectl get nodes

# 5. Crear los secretos (EDITA secrets.yaml con contraseñas reales primero)
kubectl apply -f k8s/secrets.yaml
kubectl apply -f k8s/db-configmap.yaml

# 6. Desplegar base de datos
kubectl apply -f k8s/deployments/db-deployment.yaml

# 7. Esperar que la DB esté lista
kubectl wait --for=condition=ready pod -l app=db --timeout=60s

# 8. Desplegar todos los servicios
kubectl apply -f k8s/deployments/

# 9. Instalar Nginx Ingress Controller
kubectl apply -f https://raw.githubusercontent.com/kubernetes/ingress-nginx/controller-v1.10.0/deploy/static/provider/do/deploy.yaml

# 10. Aplicar Ingress
kubectl apply -f k8s/ingress.yaml

# 11. Ver la IP pública asignada
kubectl get svc -n ingress-nginx
```

---

## 5. Configurar GitHub Actions (CI/CD)

En tu repositorio de GitHub, ve a **Settings → Secrets and variables → Actions** y agrega:

| Secret               | Valor                                      |
|----------------------|--------------------------------------------|
| `DOCKER_USERNAME`    | Tu usuario de Docker Hub                   |
| `DOCKER_TOKEN`       | Token de Docker Hub (Account Settings)     |
| `DIGITALOCEAN_TOKEN` | Token de API de DigitalOcean               |
| `K8S_CLUSTER_NAME`   | `upvshop-cluster`                          |

Cada `git push` a `main` disparará automáticamente el pipeline.

---

## 6. Comandos útiles

```bash
# Ver logs de un servicio
docker-compose logs -f users-service

# Reiniciar un servicio
docker-compose restart catalog-service

# Entrar a la base de datos
docker exec -it upvshop-db psql -U admin -d upvshop

# Ver pods en Kubernetes
kubectl get pods

# Ver logs en Kubernetes
kubectl logs -f deployment/users-service

# Escalar un servicio
kubectl scale deployment catalog-service --replicas=3

# Parar todo (local)
docker-compose down

# Parar y borrar volúmenes (reset BD)
docker-compose down -v
```

---

## Estructura del proyecto

```
upvshop/
├── services/
│   ├── users-service/      # FastAPI - usuarios y autenticación
│   ├── catalog-service/    # FastAPI - catálogo de productos
│   ├── cart-service/       # FastAPI - carrito de compras
│   ├── order-service/      # FastAPI - órdenes
│   └── payment-service/    # FastAPI - pagos simulados
├── k8s/
│   ├── deployments/        # Manifiestos de Kubernetes
│   ├── secrets.yaml        # Secretos (no subir a Git con datos reales)
│   ├── db-configmap.yaml   # SQL de inicialización
│   └── ingress.yaml        # Ingress Nginx
├── .github/
│   └── workflows/
│       └── ci-cd.yml       # Pipeline CI/CD
├── init.sql                # SQL inicial para desarrollo local
├── docker-compose.yml      # Orquestación local
└── README.md
```

---

## Tecnologías

- **Backend**: Python 3.11 + FastAPI + Uvicorn
- **Base de datos**: PostgreSQL 15
- **Autenticación**: JWT (PyJWT + bcrypt)
- **Contenedores**: Docker + Docker Compose
- **Orquestación**: Kubernetes (DigitalOcean DOKS)
- **CI/CD**: GitHub Actions
- **Registro de imágenes**: Docker Hub
