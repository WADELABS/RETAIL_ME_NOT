# Catalog & Product Information Management (PIM)

## 1. Domain Definition

The Catalog and Product Information Management (PIM) domains are the authoritative source for all product-related data in the ECOS. They are responsible for the entire lifecycle of a product, from initial data ingestion to enrichment, quality scoring, and readiness for publication.

- **Bounded Context:** This domain's responsibility begins with raw product data from suppliers and ends with a fully enriched, validated, and queryable product entity. It knows everything about *what* a product is, but it does not know its price, its stock level, or its risk score. Those are the responsibilities of the Pricing, Inventory, and Risk domains, respectively.
- **Core Services:**
    - **PIM Service:** Handles the ingestion, normalization, and enrichment of product data. It is the write-heavy part of the domain.
    - **Catalog Service:** Provides a highly-available, read-optimized view of the final, approved products for consumption by storefronts and other applications.

## 2. Key Performance Indicators (KPIs)

- **Catalog Richness Score:** Percentage of products that have a complete set of defined attributes (e.g., images, specs, compatibility).
- **Time-to-Live (TTL):** Average time from when a new supplier product feed is ingested to when the product is published and live on the storefront.
- **Data Quality Score:** Percentage of products with no validation errors (e.g., missing brand, invalid categories).
- **API Performance:** p99 latency for key read endpoints (e.g., `GET /products/{sku}`).

## 3. Data Model

The PIM/Catalog data model is extensive, designed to capture the rich and complex nature of electronics products. It consists of many normalized tables to ensure data integrity and flexibility.

### Core Product Tables

- **`products`**: The central product record.
  - `product_id` (PK), `sku` (UNIQUE), `master_product_id` (FK, for variants), `brand_id` (FK), `series_id` (FK), `lifecycle_status` (e.g., NEW, ACTIVE, EOL), `publication_status`, `quality_score`, `created_at`, `updated_at`.
- **`brands`**:
  - `brand_id` (PK), `name` (UNIQUE), `logo_url`, `description`.
- **`series`**: A product line within a brand (e.g., "GeForce RTX 40 Series").
  - `series_id` (PK), `brand_id` (FK), `name`.
- **`categories`**: A hierarchical structure for product classification.
  - `category_id` (PK), `parent_category_id` (FK), `name`, `path`.

### Enrichment & Specification Tables

- **`product_attributes`**: A key-value store for flexible, product-specific data.
  - `attribute_id` (PK), `product_id` (FK), `name` (e.g., 'Clock Speed', 'Core Count'), `value`.
- **`product_specifications`**: A more structured version for templated specs.
  - `spec_id` (PK), `product_id` (FK), `template_id` (FK), `spec_data` (JSONB).
- **`media`**: Stores all product-related assets.
  - `media_id` (PK), `product_id` (FK), `type` (IMAGE, VIDEO, DOCUMENT), `url`, `alt_text`, `sort_order`.

### Relationship & Compatibility Tables

- **`product_relationships`**: Defines how products relate to each other.
  - `relationship_id` (PK), `source_product_id` (FK), `target_product_id` (FK), `relationship_type` (ACCESSORY, REPLACEMENT_PART, BUNDLE_MEMBER).
- **`compatibility_definitions`**: Manages compatibility rules (e.g., "CPU Socket LGA1700 is compatible with Z790 Chipset").
  - `compat_id` (PK), `source_attribute_name`, `source_attribute_value`, `target_attribute_name`, `target_attribute_value`.

### Policy & Governance Tables

- **`map_policies`**: Manufacturer's Advertised Price policies.
  - `map_policy_id` (PK), `brand_id` (FK), `policy_details`, `effective_date`.
- **`shipping_restrictions`**: Rules for shipping specific products.
  - `restriction_id` (PK), `product_id` (FK), `restriction_type` (HAZMAT, BATTERY, REGIONAL_BAN), `details`.
- **`warranty_policies`**:
  - `warranty_policy_id` (PK), `product_id` (FK), `duration_months`, `warranty_provider` (MANUFACTURER, SUPPLIER, ECOS), `details`.

## 4. API Contracts (Conceptual)

The Catalog domain will expose a versioned REST API for querying product data.

### PIM Service (Write-oriented)
- `POST /v1/ingestion/feeds`: Ingest a raw product feed from a supplier.
- `POST /v1/products`: Create a new master product record.
- `PATCH /v1/products/{sku}`: Update product attributes, specifications, and relationships.

### Catalog Service (Read-optimized)
- `GET /v1/products/{sku}`: Retrieve a single, fully-formed product view.
- `GET /v1/products`: List products, with filtering by category, brand, etc.
- `POST /v1/products/search`: A dedicated search endpoint powered by the Search domain.
- `GET /v1/products/{sku}/accessories`: Get compatible accessories for a product.
- `GET /v1/brands`: List all brands.
- `GET /v1/categories`: Get the category tree.

## 5. Key Events Published

The Catalog domain publishes events to the Event Bus to inform other parts of the ECOS of changes.

- **`catalog.product.created`**: A new product has been created in the PIM.
  - **Payload**: `product_id`, `sku`, `brand_id`.
- **`catalog.product.updated`**: An attribute of a product has been updated.
  - **Payload**: `product_id`, `sku`, changed fields with before/after.
- **`catalog.product.validation.passed`**: A product has been successfully enriched and validated, and is ready for the Decision Engine.
  - **Payload**: `product_id`, `sku`, `quality_score`.
- **`catalog.product.published`**: The Decision Engine has approved publication. This is the trigger for the storefront to display the product.
  - **Payload**: The complete, read-optimized product data view.
- **`catalog.product.unpublished`**: The Decision Engine has revoked publication.
  - **Payload**: `product_id`, `sku`, `reason`.
- **`catalog.brand.created`**
- **`catalog.category.updated`**
