const request = require("supertest");
const app = require("../src/app");

describe("images", () => {
  jest.setTimeout(15000);

  it("GET /api/images -> 200 and has src", async () => {
    const res = await request(app)
      .get("/api/images")
      .query({ query: "tel aviv" });
    expect(res.status).toBe(200);
    expect(res.body).toHaveProperty("src");
    expect(typeof res.body.src).toBe("string");
    expect(res.body.src.startsWith("http")).toBe(true);
  });
});