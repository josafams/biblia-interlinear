import { afterEach, expect, test, vi } from "vitest";
import { createDrive } from "../../src/lib/account/drive";

const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { "Content-Type": "application/json" } });
afterEach(() => vi.unstubAllGlobals());

test("queryDrive follows the pages and sends the token", async () => {
  const fetch = vi
    .fn()
    .mockResolvedValueOnce(json(200, { files: [{ id: "a" }], nextPageToken: "p2" }))
    .mockResolvedValueOnce(json(200, { files: [{ id: "b" }] }));
  vi.stubGlobal("fetch", fetch);
  const drive = createDrive(
    async () => "tok",
    () => {}
  );
  expect(await drive.queryDrive("name contains 'lote-'")).toEqual([{ id: "a" }, { id: "b" }]);
  expect(fetch.mock.calls[1][0]).toContain("&pageToken=p2");
  expect(fetch.mock.calls[0][1].headers.Authorization).toBe("Bearer tok");
});

test("a refused token is renewed once", async () => {
  vi.stubGlobal(
    "fetch",
    vi
      .fn()
      .mockResolvedValueOnce(json(401, {}))
      .mockResolvedValueOnce(json(200, { ok: 1 }))
  );
  const forget = vi.fn();
  const drive = createDrive(async () => "tok", forget);
  expect(await drive.readStorage("f1")).toEqual({ ok: 1 });
  expect(forget).toHaveBeenCalledOnce();
});

test("errors carry a code", async () => {
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(json(403, { error: { message: "The user's Drive storage quota has been exceeded." } })));
  await expect(
    createDrive(
      async () => "tok",
      () => {}
    ).removeRecord("f1")
  ).rejects.toMatchObject({ errorCode: "drive-full", status: 403 });
  vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("", { status: 500 })));
  await expect(
    createDrive(
      async () => "tok",
      () => {}
    ).readStorage("f1")
  ).rejects.toMatchObject({
    errorCode: "http-500",
    message: "Erro 500 no Google Drive"
  });
});
