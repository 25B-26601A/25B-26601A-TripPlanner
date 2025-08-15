const request = require("supertest");
const app = require("../src/app");

describe("smoke", () => {
  it("GET /healthz -> 200 ok", async () => {
    const res = await request(app).get("/healthz");
    expect(res.status).toBe(200);
    expect(res.text).toBe("ok");
  });

  it("GET /api/ping -> 200 with ok:true", async () => {
    const res = await request(app).get("/api/ping");
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("ok", true);
    expect(typeof res.body.time).toBe("string");
  });

  it("GET /api/trips without token -> 401", async () => {
    const res = await request(app).get("/api/trips");
    expect(res.status).toBe(401);
  });
});
