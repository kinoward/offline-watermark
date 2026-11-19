import { messageError } from './messages.ts';

export async function unpackGzip(compressed: ArrayBuffer): Promise<ArrayBuffer> {
  try {
    // WebKit cannot read Blob streams from a Worker started by a file URL.
    const input = new ReadableStream<Uint8Array<ArrayBuffer>>({
      start(controller) {
        controller.enqueue(new Uint8Array(compressed));
        controller.close();
      },
    });
    return await new Response(input.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer();
  } catch (cause) {
    throw messageError('offlineUnavailable', undefined, { cause });
  }
}

export function unpackWasm(compressed: ArrayBuffer | undefined): Promise<ArrayBuffer> {
  if (!compressed) throw messageError('offlineUnavailable');
  return unpackGzip(compressed);
}
