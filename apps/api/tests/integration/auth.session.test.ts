import request from "supertest";
import { afterAll, beforeAll, beforeEach, describe, expect, it } from "vitest";

import type { Container } from "../../src/container.js";
import { seedUser } from "../helpers/seed-users.js";
import { createTestContainer, resetDatabase, TEST_WEB_ORIGIN } from "../helpers/test-app.js";

const cookieValue = (response: request.Response, name: string) => {
  const header = response.headers["set-cookie"] as unknown as string[] | undefined;
  const line = header?.find((value) => value.startsWith(`${name}=`));
  return line?.split(";")[0]!.slice(name.length + 1);
};

describe("session refresh and logout", () => {
  let container: Container;
  const password = "correct horse battery";

  beforeAll(async () => {
    container = await createTestContainer();
    await container.database.connect();
  });

  afterAll(async () => {
    await container.database.disconnect();
  });

  beforeEach(async () => {
    await resetDatabase(container);
  });

  const signedInAgent = async () => {
    const user = await seedUser(container, {
      email: "jane@example.com",
      password,
      roles: ["member"],
    });
    // The Origin header makes the agent look like the web app, as the CSRF check expects.
    const agent = request.agent(container.app).set("Origin", TEST_WEB_ORIGIN);
    const login = await agent.post("/auth/login").send({ email: "jane@example.com", password });
    return { user, agent, refreshToken: cookieValue(login, "docket_refresh")! };
  };

  it("issues fresh cookies on refresh and picks up a newly assigned role", async () => {
    const { user, agent, refreshToken } = await signedInAgent();
    const admin = await container.database.client.role.findUniqueOrThrow({
      where: { name: "admin" },
    });
    await container.database.client.userRole.create({
      data: { userId: user.id, roleId: admin.id },
    });

    const response = await agent.post("/auth/refresh");

    expect(response.status).toBe(200);
    expect(response.body.user.permissions).toContain("users:manage");
    expect(cookieValue(response, "docket_refresh")).not.toBe(refreshToken);
    expect(cookieValue(response, "docket_access")).toBeTruthy();
  });

  it("ends every session in the family when an old refresh token is replayed", async () => {
    const { agent, refreshToken } = await signedInAgent();
    await agent.post("/auth/refresh");

    const replay = await request(container.app)
      .post("/auth/refresh")
      .set("Origin", TEST_WEB_ORIGIN)
      .set("Cookie", `docket_refresh=${refreshToken}`);
    const legitimate = await agent.post("/auth/refresh");

    expect(replay.status).toBe(401);
    expect(replay.body.error.code).toBe("SESSION_EXPIRED");
    expect(legitimate.status).toBe(401);
    await expect(
      container.database.client.refreshToken.count({ where: { revokedAt: null } }),
    ).resolves.toBe(0);
  });

  it("answers a refresh without a cookie with 401 and clears cookies", async () => {
    const response = await request(container.app).post("/auth/refresh");

    expect(response.status).toBe(401);
    expect(response.body.error.code).toBe("SESSION_EXPIRED");
    expect(response.headers["set-cookie"]).toEqual(
      expect.arrayContaining([expect.stringMatching(/^docket_access=;.*Expires=Thu, 01 Jan 1970/)]),
    );
  });

  it("logs out by revoking the session and clearing both cookies", async () => {
    const { agent } = await signedInAgent();

    const logout = await agent.post("/auth/logout");
    const afterwards = await agent.post("/auth/refresh");

    expect(logout.status).toBe(204);
    const cleared = (logout.headers["set-cookie"] as unknown as string[]).map(
      (line) => line.split("=")[0],
    );
    expect(cleared).toEqual(["docket_access", "docket_refresh", "docket_session"]);
    expect(afterwards.status).toBe(401);
    await expect(
      container.database.client.refreshToken.count({ where: { revokedAt: null } }),
    ).resolves.toBe(0);
  });

  it("treats logging out twice as success", async () => {
    const { agent } = await signedInAgent();
    await agent.post("/auth/logout");

    await expect(agent.post("/auth/logout")).resolves.toMatchObject({ status: 204 });
  });
});
