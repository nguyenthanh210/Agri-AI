# 🌾 OmniFarm - Nền Tảng Nông Nghiệp Thông Minh Toàn Diện

![Project Status](https://img.shields.io/badge/status-active-success.svg)
![Build@HUB 2026](https://img.shields.io/badge/Build@HUB_Hackathon-2026-blue.svg)
![License](https://img.shields.io/badge/license-MIT-blue.svg)
![Python](https://img.shields.io/badge/python-3.10+-blue.svg)
![Flutter](https://img.shields.io/badge/flutter-3.0+-02569B.svg)

> **OmniFarm** là giải pháp tiên phong ứng dụng **Trí tuệ nhân tạo (AI)**, **Công nghệ viễn thám (Remote Sensing)**, và **Hệ sinh thái IoT Châu Âu (FIWARE)** vào quản lý nông nghiệp quy mô lớn. 

Được thiết kế để giải quyết bài toán thiếu đồng bộ dữ liệu và giám sát thủ công, OmniFarm mang đến một "bộ não trung tâm" giúp các hợp tác xã và chủ trang trại tối ưu hóa năng suất, giảm thiểu rủi ro dịch bệnh và đưa ra quyết định dựa trên dữ liệu thực tế (Data-Driven Agriculture).

---

## 🎯 Bài Toán & Giải Pháp

**Vấn đề:** Nông dân thường canh tác dựa vào kinh nghiệm, thiếu thông tin tổng quan về sức khỏe cây trồng trên diện rộng, và không có công cụ dự báo sớm dịch bệnh. Dữ liệu cảm biến (IoT) bị phân mảnh, khó quản lý tập trung, dẫn đến rủi ro mất mùa và lãng phí tài nguyên.

**Giải pháp của OmniFarm:**
1. 🛰️ **Giám sát diện rộng bằng Vệ tinh:** Tự động kéo dữ liệu từ hệ thống vệ tinh Sentinel-2 (Copernicus) để phân tích chỉ số sức khỏe thảm thực vật (NDVI), giúp bao quát hàng nghìn hecta mà không cần ra đồng.
2. 🤖 **Chẩn đoán bệnh cục bộ bằng AI:** Sử dụng Deep Learning (TensorFlow) nhận diện tức thời các loại bệnh phổ biến qua ảnh chụp từ smartphone của người nông dân.
3. 🔗 **Đồng bộ IoT Chuẩn NGSI-LD:** Tích hợp hệ sinh thái FIWARE (Orion Context Broker, QuantumLeap, CrateDB) để thu thập và chuẩn hóa mọi dữ liệu cảm biến nông nghiệp theo tiêu chuẩn Châu Âu.

---

## 🌟 Tính Năng Cốt Lõi (Core Features)

### 1. 🛰️ Vệ Tinh (Satellite Intelligence)
- Phân tích sức khỏe cây trồng (NDVI) định kỳ từ vệ tinh **Sentinel-2**.
- Ước tính độ ẩm đất bề mặt sử dụng dữ liệu radar **Sentinel-1**.
- Nguồn dữ liệu: [Copernicus Data Space Ecosystem](https://dataspace.copernicus.eu/).

### 2. 🦠 AI Chẩn Đoán & Dự Báo (AI Disease & Pest Forecast)
- Sử dụng mô hình **TensorFlow/Keras** để chẩn đoán bệnh cây trồng qua ảnh lá cực nhanh và nhẹ.
- Phân tích dữ liệu lịch sử xuất hiện dịch hại từ **GBIF** kết hợp thời tiết để cảnh báo rủi ro bùng phát.

### 3. 🌐 Quản Lý Chuẩn FIWARE IoT
- Dữ liệu chuẩn hóa theo **NGSI-LD** của ETSI, tương thích với Smart Data Models (`AgriParcel`, `AgriCrop`, `WeatherObserved`).
- Sử dụng **Orion Context Broker** quản lý dữ liệu thời gian thực và **CrateDB** lưu trữ time-series.

### 4. 🌦️ Quản Lý Trang Trại & Thời Tiết
- Vẽ ranh giới lô thửa bằng định vị GPS và **OpenStreetMap**.
- Dự báo thời tiết nông vụ chuyên sâu từ **Open-Meteo**.
- Admin Dashboard quản trị toàn hệ thống.

---

## 🛠️ Công Nghệ & Thư Viện (Tech Stack)

Hệ thống được thiết kế theo **Clean Architecture** ở Backend và kiến trúc Microservices vững chắc.

| Thành phần | Công Nghệ / Thư Viện | Mục Đích |
| :--- | :--- | :--- |
| **Backend** | FastAPI, SQLAlchemy, APScheduler | Web Server & Business Logic |
| **AI/ML** | TensorFlow, Keras | Chẩn đoán bệnh bằng AI |
| **Viễn thám**| Rasterio, NumPy, httpx | Xử lý ảnh vệ tinh GeoTIFF |
| **FIWARE** | Orion-LD, QuantumLeap, CrateDB, MongoDB | IoT Platform & Time-series DB |
| **Mobile** | Flutter, Provider, Flutter Map | Ứng dụng di động đa nền tảng |

---

## 🚀 Hướng Dẫn Khởi Chạy Nhanh (Quick Start)

### Chạy bằng Docker (Khuyên dùng)
Cách nhanh nhất để khởi chạy toàn bộ Backend và hệ sinh thái FIWARE:

```bash
# 1. Clone repository
git clone https://github.com/CuongKenn/ICTU-OpenAgri.git
cd ICTU-OpenAgri

# 2. Khởi chạy toàn bộ hệ thống
docker-compose up --build
```
*Các dịch vụ sẽ có mặt tại:*
- Backend API: `http://localhost:8000` (Docs: `http://localhost:8000/api/docs`)
- Frontend Web: `http://localhost:3000`
- Orion-LD: `http://localhost:1026`
- QuantumLeap: `http://localhost:8668`
- CrateDB Admin UI: `http://localhost:4200`

### Thiết lập Frontend (Mobile App)
Yêu cầu đã cài đặt Flutter SDK:
```bash
cd frontend
flutter pub get
flutter run
```

---

## 🏗️ Kiến Trúc Hệ thống (C4 Model)

Hệ thống được thiết kế theo mô hình **C4 Model** kết hợp với **Clean Architecture**.

### Level 1: System Context (Bối cảnh hệ thống)

```mermaid
graph TD
    classDef person fill:#08427b,stroke:#052e56,color:white;
    classDef system fill:#1168bd,stroke:#0b4884,color:white;
    classDef external fill:#999999,stroke:#6b6b6b,color:white;
    classDef fiware fill:#ff6600,stroke:#cc5200,color:white;

    Farmer("🧑‍🌾 Nông Dân"):::person
    Admin("👨‍💻 Quản Trị Viên"):::person

    System("📱 OmniFarm System"):::system

    Copernicus("🛰️ Copernicus Data Space<br>(Ảnh vệ tinh Sentinel-1/2)"):::external
    GBIF("🐞 GBIF API<br>(Dữ liệu sâu bệnh)"):::external
    Weather("🌦️ Open-Meteo<br>(Thời tiết)"):::external
    OSM("🗺️ OpenStreetMap<br>(Bản đồ nền)"):::external
    SmartDataModels("📊 Smart Data Models<br>(NGSI-LD AgriFood)"):::fiware

    Farmer -->|Quản lý vùng trồng, xem thời tiết, chẩn đoán bệnh| System
    Admin -->|Quản lý người dùng, thống kê hệ thống| System
    System -->|Tải ảnh vệ tinh & chỉ số NDVI/Soil Moisture| Copernicus
    System -->|Tra cứu lịch sử dịch hại| GBIF
    System -->|Lấy dữ liệu thời tiết hiện tại & dự báo| Weather
    System -->|Hiển thị bản đồ| OSM
    System -.->|Tuân thủ chuẩn dữ liệu| SmartDataModels
```

### Level 2: Container (Thành phần chứa)

```mermaid
graph TD
    classDef mobile fill:#2d882d,stroke:#1e5b1e,color:white;
    classDef api fill:#1168bd,stroke:#0b4884,color:white;
    classDef db fill:#2f2f2f,stroke:#000000,color:white;
    classDef file fill:#e6b800,stroke:#b38f00,color:white;
    classDef ext fill:#999999,stroke:#6b6b6b,color:white;
    classDef fiware fill:#ff6600,stroke:#cc5200,color:white;

    User("👤 Người Dùng")

    subgraph "OmniFarm System"
        MobileApp("📱 Mobile App<br>[Flutter + Provider]"):::mobile
        Backend("⚙️ Backend API<br>[FastAPI + Python]"):::api
        Database("🗄️ Database<br>[SQLite/PostgreSQL]"):::db
        FileStore("📂 File Storage<br>[Local Disk/S3]"):::file

        subgraph "FIWARE Stack"
            Orion("🔗 Orion-LD<br>[Context Broker]"):::fiware
            QuantumLeap("📈 QuantumLeap<br>[Time-series API]"):::fiware
            MongoDB("🍃 MongoDB<br>[Context Data]"):::db
            CrateDB("📊 CrateDB<br>[Time-series DB]"):::db
        end
    end

    External("☁️ External APIs"):::ext

    User -->|Tương tác UI| MobileApp
    MobileApp -->|REST API JSON| Backend
    Backend -->|SQLAlchemy Async| Database
    Backend -->|Read Write Images Models| FileStore
    Backend -->|HTTP Requests| External
    Backend -->|NGSI-LD Entities| Orion
    Orion -->|Store Context| MongoDB
    Orion -->|Notify Changes| QuantumLeap
    QuantumLeap -->|Store History| CrateDB
    Backend -.->|Chạy mô hình AI| FileStore
```

### Level 3: Component (Kiến trúc Backend)

```mermaid
graph TD
    classDef layer fill:#ffffff,stroke:#000000,color:black;
    classDef infra fill:#e1f5fe,stroke:#01579b,color:black;
    classDef domain fill:#fff3e0,stroke:#e65100,color:black;
    classDef fiware fill:#ffe0b2,stroke:#ff6600,color:black;

    subgraph "Backend Server (Clean Architecture)"
        API["📡 Presentation Layer<br>(API Routers & Endpoints)"]:::layer

        subgraph "Application Layer"
            UseCases["🧠 Use Cases<br>(Business Logic)"]:::layer
            Scheduler["⏰ Scheduler<br>(APScheduler Jobs)"]:::layer
        end

        subgraph "Domain Layer"
            Entities["💎 Entities & Interfaces<br>(Core Models)"]:::domain
        end

        subgraph "Infrastructure Layer"
            RepoImpl["💾 Repository Impl<br>(SQLAlchemy)"]:::infra
            ExtServices["🔌 External Services<br>(GBIF, Weather, Sentinel)"]:::infra
            AIModule["🤖 AI Engine<br>(TensorFlow/Keras)"]:::infra
            SatModule["🛰️ Satellite Processor<br>(Rasterio/NumPy)"]:::infra
            FiwareClient["🔗 FIWARE Client<br>(NGSI-LD API)"]:::fiware
        end
    end

    API --> UseCases
    UseCases --> Entities
    UseCases --> RepoImpl
    UseCases --> ExtServices
    UseCases --> AIModule
    UseCases --> SatModule
    UseCases --> FiwareClient
    Scheduler --> FiwareClient

    RepoImpl -.->|Implements| Entities
    ExtServices -.->|Implements| Entities
```

---

## 🤝 Đóng Góp (Contributing)
Chúng tôi rất hoan nghênh mọi đóng góp từ cộng đồng! Mở Pull Request hoặc Issue trên kho lưu trữ.

## 📄 Giấy Phép (License)
Dự án này được phân phối dưới giấy phép **MIT License**. Xem file `LICENSE` để biết thêm chi tiết.

## 📞 Liên Hệ
- **Tác giả**: CuongKenn
- **GitHub**: [https://github.com/CuongKenn/ICTU-OpenAgri](https://github.com/CuongKenn/ICTU-OpenAgri)

---
*Phát triển với ❤️ vì nền nông nghiệp số hiện đại.*
