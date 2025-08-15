const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../src/app");
const connectDB = require("../src/config/db");
const User = require("../src/models/User");

describe("auth", () => {
  const email = `jest+${Date.now()}@example.com`;
  const password = "123456";
  let token = "";

  beforeAll(async () => {
    await connectDB();
  });

  afterAll(async () => {
    await User.deleteOne({ email });
    await mongoose.disconnect();
  });

  it("register -> 201", async () => {
    const res = await request(app)
      .post("/api/auth/register")
      .send({ name: "Jest", email, password })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(201);
    expect(res.body).toHaveProperty("token");
    token = res.body.token;
  });

  it("login -> 200", async () => {
    const res = await request(app)
      .post("/api/auth/login")
      .send({ email, password })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("token");
  });

  it("me -> 200", async () => {
    const res = await request(app)
      .get("/api/auth/me")
      .set("Authorization", `Bearer ${token}`);
    expect(res.status).toBe(200);
    expect(res.body?.user?.email).toBe(email.toLowerCase());
  });
});
