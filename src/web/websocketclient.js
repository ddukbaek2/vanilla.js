//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 웹소켓 통신 처리기.
//==============================================================================
export class WebSocketClient extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebSocket | null } */ #webSocket = null;
	/** @private @type { boolean } */ #isConnected = false;
	/** @private @type { Function | null } */ #receiveEvent = null;

	//==============================================================================
	// 생성.
	//==============================================================================
	/**
	 * @constructor
	 */
	constructor() {
		super();

		this.#webSocket = null;
		this.#isConnected = false;
		this.#receiveEvent = null;
	}

	//==============================================================================
	// 접속.
	//==============================================================================
	/**
	 * @param { string } url
	 */
	connect(url) {
		if (this.#isConnected) {
			return;
		}

		this.#webSocket = new System.WebSocket(url);
		const webSocket = this.getWebSocket();

		webSocket.onopen = () => {
			this.#isConnected = true;
		};

		webSocket.onclose = () => {
			this.#isConnected = false;
			this.#webSocket = null;
		};

		webSocket.onerror = (errorEvent) => {
			console.error(errorEvent);
		};

		webSocket.onmessage = (messageEvent) => {
			if (this.#receiveEvent === null) {
				return;
			}
			
			try {
				const text = messageEvent.data;
				const obj = System.JSON.parse(text);
				this.#receiveEvent(obj);
			}
			catch (error) {
				console.error(error);
			}
		};
	}

	//==============================================================================
	// 접속 해제.
	//==============================================================================
	disconnect() {
		const isConnected = this.isConnected();
		if (!isConnected) {
			return;
		}

		const webSocket = this.getWebSocket();
		webSocket.close();
	}

	//==============================================================================
	// JSON 송신.
	//==============================================================================
	/**
	 * @param { object } obj
	 */
	send(obj) {
		const isConnected = this.isConnected();
		if (!isConnected) {
			return;
		}

		try {
			const json = System.JSON.stringify(obj);
			const webSocket = this.getWebSocket();
			webSocket.send(json);
		}
		catch (error) {
			console.error(error);
		}
	}

	//==============================================================================
	// 접속 여부 반환.
	//==============================================================================
	/**
	 * @returns { boolean }
	 */
	isConnected() {
		return this.#isConnected;
	}

	//==============================================================================
	// 웹소켓 반환.
	//==============================================================================
	/**
	 * @returns { WebSocket | null } callback
	 */
	getWebSocket() {
		return this.#webSocket;
	}

	//==============================================================================
	// 수신 이벤트 설정.
	//==============================================================================
	/**
	 * @param { Function | null } callback
	 */
	setReceiveEvent(callback) {
		this.#receiveEvent = callback;
	}

	//==============================================================================
	// 수신 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { Function | null }
	 */
	getReceiveEvent() {
		return this.#webSocket;
	}
}
