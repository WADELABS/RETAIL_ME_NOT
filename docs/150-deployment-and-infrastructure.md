# Cloud Infrastructure & Kubernetes Deployment Specification

This document defines the production-grade Kubernetes (K8s) deployment manifests and infrastructure-as-code blueprints for the ECOS platform. It bridges the gap between our CI-verified codebase and a running-at-scale, cloud-native physical deployment.

---

## 1. The Persistent State Layer (PostgreSQL & Redis)

ECOS maintains strict data integrity. The state layer utilizes Persistent Volumes to ensure data is never lost during unexpected container restarts.

```yaml
apiVersion: v1
kind: PersistentVolumeClaim
metadata:
  name: ecos-postgres-pvc
  namespace: ecos-production
spec:
  accessModes:
    - ReadWriteOnce
  resources:
    requests:
      storage: 100Gi
---
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecos-postgres
  namespace: ecos-production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ecos-postgres
  template:
    metadata:
      matchLabels:
        app: ecos-postgres
    spec:
      containers:
        - name: postgres
          image: postgres:16-alpine
          ports:
            - containerPort: 5432
          env:
            - name: POSTGRES_DB
              value: ecos_production
            - name: POSTGRES_USER
              value: ecos_admin
            - name: POSTGRES_PASSWORD
              valueFrom:
                secretKeyRef:
                  name: ecos-secrets
                  key: database-password
          volumeMounts:
            - name: postgres-storage
              mountPath: /var/lib/postgresql/data
      volumes:
        - name: postgres-storage
          persistentVolumeClaim:
            claimName: ecos-postgres-pvc
---
apiVersion: v1
kind: Service
metadata:
  name: ecos-postgres-service
  namespace: ecos-production
spec:
  ports:
    - port: 5432
  selector:
    app: ecos-postgres
```

---

## 2. The Nervous System (Apache Kafka Event Bus)

To support our high-throughput, partitioned event streams, ECOS deploys a lightweight, highly-available Kafka broker.

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecos-kafka
  namespace: ecos-production
spec:
  replicas: 1
  selector:
    matchLabels:
      app: ecos-kafka
  template:
    metadata:
      matchLabels:
        app: ecos-kafka
    spec:
      containers:
        - name: kafka
          image: confluentinc/cp-kafka:7.5.0
          ports:
            - containerPort: 9092
          env:
            - name: KAFKA_NODE_ID
              value: "1"
            - name: KAFKA_LISTENER_SECURITY_PROTOCOL_MAP
              value: 'CONTROLLER:PLAINTEXT,PLAINTEXT:PLAINTEXT,PLAINTEXT_HOST:PLAINTEXT'
            - name: KAFKA_ADVERTISED_LISTENERS
              value: 'PLAINTEXT://ecos-kafka-service:9092,PLAINTEXT_HOST://localhost:29092'
            - name: KAFKA_OFFSETS_TOPIC_REPLICATION_FACTOR
              value: "1"
            - name: KAFKA_TRANSACTION_STATE_LOG_MIN_ISR
              value: "1"
            - name: KAFKA_TRANSACTION_STATE_LOG_REPLICATION_FACTOR
              value: "1"
---
apiVersion: v1
kind: Service
metadata:
  name: ecos-kafka-service
  namespace: ecos-production
spec:
  ports:
    - port: 9092
  selector:
    app: ecos-kafka
```

---

## 3. Core Service Deployments

Every ECOS domain runs as an isolated, auto-scaling deployment. Here are the blueprints for our primary transactional, intelligence, and financial services.

### 3.1. ECOS Orders Service

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecos-orders-service
  namespace: ecos-production
spec:
  replicas: 2 # Redundant replicas for continuous availability
  selector:
    matchLabels:
      app: ecos-orders
  template:
    metadata:
      matchLabels:
        app: ecos-orders
    spec:
      containers:
        - name: orders
          image: ecos-orders:v1.2.4 # Pulled from staging registry after passing Release Gate
          ports:
            - containerPort: 3000
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              value: "postgresql://ecos_admin@ecos-postgres-service:5432/ecos_production"
            - name: KAFKA_BROKERS
              value: "ecos-kafka-service:9092"
          resources:
            limits:
              cpu: "500m"
              memory: "512Mi"
            requests:
              cpu: "250m"
              memory: "256Mi"
```

### 3.2. ECOS Decision Engine

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecos-decision-engine
  namespace: ecos-production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ecos-decision-engine
  template:
    metadata:
      matchLabels:
        app: ecos-decision-engine
    spec:
      containers:
        - name: decision-engine
          image: ecos-decision-engine:v1.0.0
          env:
            - name: NODE_ENV
              value: "production"
            - name: KAFKA_BROKERS
              value: "ecos-kafka-service:9092"
            - name: REDIS_URL
              value: "redis://ecos-redis-service:6379"
```

### 3.3. ECOS General Ledger (Accounting Service)

```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: ecos-accounting-service
  namespace: ecos-production
spec:
  replicas: 2
  selector:
    matchLabels:
      app: ecos-accounting
  template:
    metadata:
      matchLabels:
        app: ecos-accounting
    spec:
      containers:
        - name: accounting
          image: ecos-accounting:v1.0.0
          env:
            - name: NODE_ENV
              value: "production"
            - name: DATABASE_URL
              value: "postgresql://ecos_admin@ecos-postgres-service:5432/ecos_production"
            - name: KAFKA_BROKERS
              value: "ecos-kafka-service:9092"
```

---

## 4. Secure Secret Management

All sensitive API keys, bank access tokens, and private credentials are kept strictly out of Git and are injected dynamically using Kubernetes Secrets.

```yaml
apiVersion: v1
kind: Secret
metadata:
  name: ecos-secrets
  namespace: ecos-production
type: Opaque
data:
  database-password: "base64_encoded_password..."
  stripe-secret-key: "base64_encoded_stripe_key..."
  mercury-api-key: "base64_encoded_mercury_key..."
  telnyx-api-key: "base64_encoded_telnyx_key..."
```
