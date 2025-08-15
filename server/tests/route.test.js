const request = require("supertest");
const app = require("../src/app");

describe("route", () => {
  it("GET /api/route/ping -> 200", async () => {
    const res = await request(app).get("/api/route/ping");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
  });

  it("POST /api/route with <2 points -> 400", async () => {
    const res = await request(app)
      .post("/api/route")
      .send({ mode: "walk", points: [{ lat: 32.1, lon: 34.8 }] })
      .set("Content-Type", "application/json");
    expect(res.status).toBe(400);
  });
});
