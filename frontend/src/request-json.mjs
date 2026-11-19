// No automatic retries: a timed-out write may already have reached the server.
export async function requestJson(url, options = {}, timeoutMs = 25000, fetchImpl = fetch) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetchImpl(url, { ...options, signal: controller.signal });
    const payload = await response.json().catch(error => { if (controller.signal.aborted) throw error; return {}; });
    if (!response.ok) {
      const error = new Error(payload?.error?.message || 'MITRA API request failed.');
      error.status = response.status;
      throw error;
    }
    if (!Object.hasOwn(payload, 'data')) throw new Error('Unexpected response from MITRA. Please try again.');
    return payload.data;
  } catch (error) {
    if (controller.signal.aborted) {
      const timeout = new Error('The request timed out. Please try again or contact the college.');
      timeout.code = 'REQUEST_TIMEOUT';
      throw timeout;
    }
    throw error;
  } finally { clearTimeout(timer); }
}
