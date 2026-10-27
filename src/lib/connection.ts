export const deviceConnectionKey = "baobao.github.device.v1";
export const sessionConnectionKey = "baobao.github.session.v1";
export type Connection = { token: string; remember: boolean };
type StorageLike = Pick<Storage, "getItem" | "setItem" | "removeItem">;
export function readConnection(
  device: StorageLike,
  session: StorageLike,
): Connection | null {
  try {
    for (const [storage, key, remember] of [
      [session, sessionConnectionKey, false],
      [device, deviceConnectionKey, true],
    ] as const) {
      const raw = storage.getItem(key);
      if (!raw) continue;
      const value = JSON.parse(raw);
      if (
        value.version === 1 &&
        typeof value.token === "string" &&
        value.token.trim().length > 0 &&
        value.token.length <= 500
      )
        return { token: value.token, remember };
    }
  } catch {
    /* A blocked credential store must never stop the public diary. */
  }
  return null;
}
export function storeConnection(
  connection: Connection,
  device: StorageLike,
  session: StorageLike,
) {
  const target = connection.remember ? device : session;
  const key = connection.remember ? deviceConnectionKey : sessionConnectionKey;
  // Write the selected store first, so failure never looks like a successful connection.
  target.setItem(key, JSON.stringify({ version: 1, token: connection.token }));
  (connection.remember ? session : device).removeItem(
    connection.remember ? sessionConnectionKey : deviceConnectionKey,
  );
}
export function clearConnection(device: StorageLike, session: StorageLike) {
  device.removeItem(deviceConnectionKey);
  session.removeItem(sessionConnectionKey);
}
