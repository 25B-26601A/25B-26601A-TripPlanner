# 🗺️ TripPlanner

TripPlanner is a web application that helps users **plan bike or walking trips** with smart, AI-assisted routes, weather insights, and the ability to save and view itineraries.

---

## 📌 Features

- **Plan Trips** — Choose between bike and walking trips, with optimized daily routes.
- **Map View** — Interactive map displaying routes and stops.
- **Weather Integration** — Shows forecast for trip days.
- **Trip History** — Save, view, and manage past trips.
- **Responsive UI** — Works seamlessly on desktop and mobile.

---

## 🛠️ Tech Stack

**Frontend**  
- React 19 + Vite
- React Router DOM
- Leaflet.js (interactive maps)
- TailwindCSS (styling)

**Backend**  
- Node.js
- Express.js
- MongoDB + Mongoose
- REST API

**Other Tools**  
- Axios (API calls)
- Pexels API (dynamic images)
- dotenv for environment variables

---

## 📂 Project Structure

```
25B-26601A-TripPlanner/
├── client/           # Frontend React app
├── server/           # Backend Express app
├── README.md
└── .gitignore
```

---

## ⚙️ Installation & Setup

### 1️⃣ Clone the Repository
```bash
git clone https://github.com/25B-26601A/25B-26601A-TripPlanner.git
cd 25B-26601A-TripPlanner
```

### 2️⃣ Install Dependencies

**Frontend**
```bash
cd client
npm install
```

**Backend**
```bash
cd ../server
npm install
```

---

### 3️⃣ Environment Variables

You will need `.env` files for both **client** and **server**.

**`client/.env` example:**
```env
VITE_API_URL=http://localhost:5000
VITE_PEXELS_API_KEY=your_pexels_api_key
```

**`server/.env` example:**
```env
PORT=5000
MONGODB_URI=mongodb://localhost:27017/tripplanner
PEXELS_API_KEY=your_pexels_api_key
```

---

### 4️⃣ Running the App

**Run Backend**
```bash
cd server
npm run dev
```

**Run Frontend**
```bash
cd ../client
npm run dev
```

**Access App**  
Visit: [http://localhost:5173](http://localhost:5173)

---

## 🚀 Deployment

When deploying, make sure to:
- Set environment variables on the hosting service (e.g., Render, Vercel, Netlify)
- Use the correct production API URL in `client/.env`

---

## 👥 Authors

- **Nir Avraham**
- **Tamar Aloni**

---

## 📜 License
This project is for educational purposes and not licensed for commercial distribution.
