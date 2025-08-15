const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

describe("trips", () => {
  const email = `jest+trip${Date.now()}@example.com`;
  const password = "123456";
  let token = "";
  let tripId = "";

  beforeAll(async () => {
    await connectDB();
    const r1 = await request(app)
      .post("/api/auth/register")
      .send({ name: "TripTester", email, password })
      .set("Content-Type", "application/json");
    expect(r1.status).toBe(201);
    token = r1.body.token;
  });

  afterAll(async () => {
    if (tripId) {
      await request(app).delete(`/api/trips/${tripId}`).set("Authorization", `Bearer ${token}`);
    }
    await User.deleteOne({ email });
    await mongoose.disconnect();
  });

  it("create -> 201", async () => {
    const res = await request(app)
      .post("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .send({
        title: "Test Trip",
        summary: "Short trip for tests",
        mode: "walk",
        destination: { name: "Tel Aviv" },
        days: [{ day: 1, start: "A", end: "B", waypoints: [] }]
      })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("_id");
    tripId = res.body._id;
  });

  it("list -> 200 and contains created id", async () => {
    const res = await request(app)
      .get("/api/trips")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    expect(res.body.some(t => t._id === tripId)).toBe(true);
  });

  it("get by id -> 200", async () => {
    const res = await request(app)
      .get(`/api/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("_id", tripId);
  });

  it("patch -> 200 updates notes", async () => {
    const res = await request(app)
      .patch(`/api/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`)
      .send({ notes: "updated" })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("notes", "updated");
  });

  it("delete -> 200/204", async () => {
    const res = await request(app)
      .delete(`/api/trips/${tripId}`)
      .set("Authorization", `Bearer ${token}`);
    expect([200, 204]).toContain(res.status);
    tripId = "";
  });
});
