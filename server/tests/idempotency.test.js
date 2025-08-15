const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

describe("trips idempotency", () => {
  jest.setTimeout(15000);
  const email = `jest+idem${Date.now()}@example.com`;
  const password = "123456";
  const key = `k-${Date.now()}`;
  let token = "";
  let tripId1 = "";
  let tripId2 = "";

  beforeAll(async () => {
    await connectDB();
    const r = await request(app)
      .post("/api/auth/register")
      .send({ name: "Idem", email, password })
      .set("Content-Type", "application/json");
    expect(r.status).toBe(201);
    token = r.body.token;
  });

  afterAll(async () => {
    for (const id of [tripId1, tripId2].filter(Boolean)) {
      await request(app).delete(`/api/trips/${id}`).set("Authorization", `Bearer ${token}`);
    }
    await User.deleteOne({ email });
    await mongoose.disconnect();
  });

  it("first create with header -> 201", async () => {
    const res = await request(app)
      .post("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({
        title: "Idem Trip",
        summary: "s",
        mode: "walk",
        destination: { name: "Tel Aviv" },
        days: [{ day: 1, start: "A", end: "B", waypoints: [] }]
      })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    tripId1 = res.body._id;
  });

  it("repeat same header -> 200 same id", async () => {
    const res = await request(app)
      .post("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", key)
      .send({
        title: "Idem Trip",
        summary: "s",
        mode: "walk",
        destination: { name: "Tel Aviv" },
        days: [{ day: 1, start: "A", end: "B", waypoints: [] }]
      })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(200);
    expect(res.body._id).toBe(tripId1);
  });

  it("different header -> 201 new id", async () => {
    const res = await request(app)
      .post("/api/trips")
      .set("Authorization", `Bearer ${token}`)
      .set("Idempotency-Key", `${key}-2`)
      .send({
        title: "Idem Trip 2",
        summary: "s",
        mode: "walk",
        destination: { name: "Tel Aviv" },
        days: [{ day: 1, start: "A", end: "B", waypoints: [] }]
      })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    tripId2 = res.body._id;
    expect(tripId2).not.toBe(tripId1);
  });
});
