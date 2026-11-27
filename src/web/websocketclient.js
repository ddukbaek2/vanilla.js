//==============================================================================
// 포함 모듈 목록.
//==============================================================================
const System = globalThis;
import { Object } from "../base/object.js";


// 수신 콜백이 없을 때 모아 두는 메시지 수 한도. (넘치면 오래된 것부터 버린다)
const RECEIVED_MESSAGE_LIMIT = 1024;


//==============================================================================
// 웹소켓 통신 처리기.
// - 받은 JSON 은 수신 콜백이 있으면 그것을 부르고, 없으면 모아 두었다가 takeReceivedMessages 로 꺼낸다. (매 프레임 꺼내 쓰는 게임용)
//==============================================================================
/**
 * @example <caption>받은 JSON 을 콜백으로 받거나 모아서 꺼내기</caption>
 * import { WebSocketClient } from "./build/vanilla.js";
 *
 * const client = new WebSocketClient();
 * client.receiveMessage({ type: "hello" });
 * console.log(client.isConnected(), client.takeReceivedMessages().length);
 * client.setReceiveEvent((message) => {
 * 	console.log(message.type);
 * });
 * client.receiveMessage({ type: "ping" });
 * console.log(client.getReceiveEvent() !== null);
 */
export class WebSocketClient extends Object {
	//==============================================================================
	// 멤버 변수 목록.
	//==============================================================================
	/** @private @type { WebSocket | null } */ #webSocket = null;
	/** @private @type { boolean } */ #isConnected = false;
	/** @private @type { Function | null } */ #receiveEvent = null;
	/** @private @type { Array<object> } */ #receivedMessageList = []; // 수신 콜백이 없을 때 모은 받은 JSON. (받은 차례)

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
		this.#receivedMessageList = [];
	}

	//==============================================================================
	// 접속.
	//==============================================================================
	/**
	 * @param { string } url 접속할 웹소켓 주소. (ws:// 나 wss://, 이미 접속 중이면 무시한다)
	 */
	connect(url) {
		if (this.#isConnected) {
			return;
		}

		this.#webSocket = new System.WebSocket(url);
		const webSocket = this.getWebSocket();
		webSocket.binaryType = "arraybuffer";

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
				// 바이너리 메시지도 UTF-8 JSON 이면 받는다.
				const data = messageEvent.data;
				let text = data;
				if (data instanceof System.ArrayBuffer) {
					const textDecoder = new System.TextDecoder("utf-8", { fatal: true });
					text = textDecoder.decode(data);
				}
				const obj = System.JSON.parse(text);
				this.receiveMessage(obj);
			}
			catch (error) {
				console.error(error);
			}
		};
	}

	//==============================================================================
	// 받은 JSON 넘기기. (수신 콜백이 있으면 콜백, 없으면 모아 두었다가 takeReceivedMessages 로 꺼낸다)
	//==============================================================================
	/**
	 * @param { object } obj 받은 JSON 객체. (수신 콜백이 있으면 콜백으로, 없으면 모아 둔다)
	 */
	receiveMessage(obj) {
		const receiveEvent = this.#receiveEvent;
		if (receiveEvent !== null) {
			receiveEvent(obj);
			return;
		}
		if (this.#receivedMessageList.length >= RECEIVED_MESSAGE_LIMIT) {
			this.#receivedMessageList.shift();
		}
		this.#receivedMessageList.push(obj);
	}

	//==============================================================================
	// 모아 둔 받은 메시지 꺼내기. (수신 콜백이 없을 때 모인 것, 받은 차례, 꺼내면 비운다)
	//==============================================================================
	/**
	 * @returns { Array<object> } 모아 둔 받은 메시지. (받은 차례, 꺼내면 비운다)
	 */
	takeReceivedMessages() {
		const receivedMessageList = this.#receivedMessageList;
		this.#receivedMessageList = [];
		return receivedMessageList;
	}

	//==============================================================================
	// 갱신. (브라우저가 사건을 그때그때 넘겨 할 일이 없다, 매 프레임 사건을 꺼내야 하는 플랫폼과 같은 코드로 쓰려고 둔다)
	//==============================================================================
	tick() {
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
	 * @param { object } obj 보낼 JSON 객체. (접속 중이 아니면 보내지 않는다)
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
	 * @returns { boolean } 접속 중이면 참.
	 */
	isConnected() {
		return this.#isConnected;
	}

	//==============================================================================
	// 웹소켓 반환.
	//==============================================================================
	/**
	 * @returns { WebSocket | null } 안쪽 웹소켓. (접속하지 않았으면 null)
	 */
	getWebSocket() {
		return this.#webSocket;
	}

	//==============================================================================
	// 수신 이벤트 설정.
	//==============================================================================
	/**
	 * @param { Function | null } callback 받은 JSON 객체를 넘겨 받을 함수. (null 이면 모아 두는 쪽으로 돌아간다)
	 */
	setReceiveEvent(callback) {
		this.#receiveEvent = callback;
	}

	//==============================================================================
	// 수신 이벤트 반환.
	//==============================================================================
	/**
	 * @returns { Function | null } 수신 콜백. (없으면 null)
	 */
	getReceiveEvent() {
		return this.#receiveEvent;
	}
}
