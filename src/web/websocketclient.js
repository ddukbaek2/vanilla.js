//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


//==============================================================================
// 받은 메시지를 모아 두는 수 한도. (수신 콜백이 없을 때, 넘치면 오래된 것부터 버린다)
//==============================================================================
const RECEIVED_MESSAGE_LIMIT = 1024;


//==============================================================================
// 웹소켓 통신 처리기.
// - 받은 JSON 은 수신 콜백이 있으면 그것을 부르고, 없으면 모아 두었다가 takeReceivedMessages 로 꺼낸다. (매 프레임 꺼내 쓰는 게임용)
//==============================================================================
export class WebSocketClient extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebSocket | null } */ #webSocket = null;
	/** @private @type { boolean } */ #isConnected = false;
	/** @private @type { Function | null } */ #receiveEvent = null;
	/** @private @type { object[] } */ #receivedMessages = [];

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
		this.#receivedMessages = [];
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
			try {
				const text = messageEvent.data;
				const obj = System.JSON.parse(text);
				if (this.#receiveEvent !== null) {
					this.#receiveEvent(obj);
				}
				else {
					this.#receivedMessages.push(obj);
					if (this.#receivedMessages.length > RECEIVED_MESSAGE_LIMIT) {
						this.#receivedMessages.shift();
					}
				}
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
		return this.#receiveEvent;
	}

	//==============================================================================
	// 모아 둔 받은 메시지 꺼내기. (온 차례대로, 꺼내면 비운다)
	//==============================================================================
	/**
	 * @returns { object[] }
	 */
	takeReceivedMessages() {
		const receivedMessages = this.#receivedMessages;
		this.#receivedMessages = [];
		return receivedMessages;
	}
}
