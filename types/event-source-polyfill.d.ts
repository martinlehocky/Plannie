declare module "event-source-polyfill" {
    interface EventSourcePolyfillInit extends EventSourceInit {
        headers?: Record<string, string>
        withCredentials?: boolean
    }

    class EventSourcePolyfill extends EventSource {
        constructor(url: string | URL, eventSourceInitDict?: EventSourcePolyfillInit)
        static readonly CLOSED: number
        static readonly CONNECTING: number
        static readonly OPEN: number
        onopen: ((this: EventSourcePolyfill, ev: Event) => any) | null
        onmessage: ((this: EventSourcePolyfill, ev: MessageEvent) => any) | null
        onerror: ((this: EventSourcePolyfill, ev: Event) => any) | null
    }

    export { EventSourcePolyfill, EventSourcePolyfillInit }
    export default EventSourcePolyfill
}