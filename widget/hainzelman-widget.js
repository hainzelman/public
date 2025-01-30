const widgetTemplate = () => {
    const icon = sendIcon;

    return `
    <div class="hainzelman-widget">
        <div class="hainzelman-widget-bubble">${chatIcon}</div>
        <div class="hainzelman-widget-window hidden">
            <div class="hainzelman-widget-navbar">
            <img class="logo" src="https://media.liscr.com/marketing/liscr/media/liscr/home/logo.png" loading="lazy" fetchpriority="high" decoding="async">
            </div>
            <div class="hainzelman-widget-window-body">
            </div>
            <div class="hainzelman-widget-agent-typing hidden">
                <p>Agent is typing...</p>
            </div>
            <div class="hainzelman-widget-input-wrapper">
                <textarea class="hainzelman-widget-input" placeholder="Enter your message here." maxlength="5000"></textarea>
                <button class="hainzelman-widget-send-button">
                ${icon}
                </button>
            </div>
        </div>
    </div>
`;
};

const messageTemplate = (content, role) => {
    let icon;
    switch (role) {
        case "assistant":
            icon = globeIcon;
            break;
        case "user":
            icon = personIcon;
            break;
        case "assistant-err":
            icon = globeErrorIcon;
            break;
        default:
            icon = "";
            break;
    }
    return `
        <div class="hainzelman-widget-message hainzelman-widget-message-${role}">
            <span class="hainzelman-widget-message-icon">
                ${icon}
            </span>
            <div class="hainzelman-widget-message-content">
                <p>${content}</p>
            </div>
        </div>
    `;
};

const LOCAL_STORAGE = {
    chatId: "HAINZELMAN_CHAT_ID",
};

class HainzelmanUtil {
    baseUrl;
    auth;

    constructor(url, auth) {
        this.baseUrl = url;
        this.auth = auth;
    }

    async createChat() {
        try {
            const response = await fetch(`${this.baseUrl}/chat/create`, {
                method: "POST",
                headers: {
                    Authorization: this.auth,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    isWidgetChat: true,
                    rag: true
                })
            });
            if (!response.ok) return console.error("Failed to create chat", await response.text());

            const data = await response.json();
            return data.result;
        } catch (error) {
            console.error("Failed to create chat", error);
            return false;
        }
    }

    async getChat(chatId) {
        try {
            const response = await fetch(`${this.baseUrl}/chat/${chatId}`, {
                method: "GET",
                headers: {
                    Authorization: this.auth
                }
            });
            if (!response.ok) throw Error(await response.text());

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Failed to create chat", error);
            return false;
        }
    }

    async sendMessage(chatId, prompt) {
        try {
            const response = await fetch(`${this.baseUrl}/widget/chat`, {
                method: "POST",
                headers: {
                    Authorization: this.auth,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chatId,
                    prompt
                })
            });

            if (!response.ok) throw Error(await response.text());

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Failed to send message", error);
            return false;
        }
    }

    async sendContactData(chatId, prompt, supportEmail) {
        try {
            const response = await fetch(`${this.baseUrl}/widget/contact`, {
                method: "POST",
                headers: {
                    Authorization: this.auth,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    chatId,
                    prompt,
                    supportEmail
                })
            });

            if (!response.ok) throw Error(await response.text());

            const data = await response.json();
            return data;
        } catch (error) {
            console.error("Failed to send message", error);
            return false;
        }
    }
}

class HainzelmanWidget {
    root;
    config;
    fetch;

    state = new Proxy(
        {
            chat: {},
            minimized: true,
            redirectToHuman: false,
            waitingResponse: false
        },
        {
            set: (target, property, value) => {
                if (target[property] !== value) {
                    target[property] = value;
                    if (property === "chat") this.createChatHistory();
                    if (property === "waitingResponse") {
                        value === true
                            ? this.selectors.agentTyping.classList.remove("hidden")
                            : this.selectors.agentTyping.classList.add("hidden");
                        this.selectors.input.disabled = value;
                        this.selectors.input.focus();
                    }
                }
                return true;
            },
        }
    );

    selectors = {
        bubble: undefined,
        window: undefined,
        windowBody: undefined,
        sendButton: undefined,
        input: undefined,
        agentTyping: undefined
    };

    constructor() { }

    static init(containerSelector, config) {
        const instance = new HainzelmanWidget();

        if (!config.console) {
            console = {
                log: () => { },
                debug: () => { },
                warn: () => { },
                error: () => { }
            };
        }

        instance.root = document.getElementById(containerSelector);
        instance.config = config;
        instance.fetch = new HainzelmanUtil(config.baseUrl, config.auth);
        instance.createContainer();
        instance.initChat();

        return instance;
    }

    async initChat() {
        // const chatId = localStorage.getItem(LOCAL_STORAGE.chatId);
        const chatId = undefined;
        const chat = chatId ? await this.fetch.getChat(chatId) : await this.fetch.createChat();

        if (!chat) {
            return localStorage.removeItem(LOCAL_STORAGE.chatId);
        }

        this.state.chat = {
            ...chat,
            messages: [
                {
                    role: "assistant",
                    content: this.config.greetingMessage,
                },
                ...(chat?.messages || []),
            ],
        };
        localStorage.setItem(LOCAL_STORAGE.chatId, this.state.chat.id);
    }

    createContainer() {
        this.root.appendChild(this.createElementFromTemplate(widgetTemplate()));
        this.addSelectors();
        this.addListeners();
    }

    createChatHistory() {
        for (const msg of this.state.chat.messages) {
            this.createChatMessage(msg.content, msg.role);
        }
    }

    createChatMessage(content, role) {
        const msgEl = this.createElementFromTemplate(messageTemplate(content, role))
        if (window.markdownit) {
            const md = window.markdownit();

            msgEl.querySelector(".hainzelman-widget-message-content").innerHTML = md.render(content)

        }
        this.selectors.windowBody.appendChild(msgEl);
        this.scrollToLastMessage();
    }

    scrollToLastMessage() {
        const lastMessage = this.selectors.windowBody.lastChild;
        this.selectors.windowBody.scrollTop = lastMessage.offsetTop;
    }

    addSelectors() {
        this.selectors.bubble = this.root.querySelector(".hainzelman-widget-bubble");
        this.selectors.window = this.root.querySelector(".hainzelman-widget-window");
        this.selectors.windowBody = this.root.querySelector(".hainzelman-widget-window-body");
        this.selectors.sendButton = this.root.querySelector(".hainzelman-widget-send-button");
        this.selectors.input = this.root.querySelector(".hainzelman-widget-input");
        this.selectors.agentTyping = this.root.querySelector(".hainzelman-widget-agent-typing");
    }

    addListeners() {
        this.selectors.bubble.onclick = () => {
            this.toggleWindow();
        };

        this.selectors.input.onkeydown = (e) => {
            if (e.code === "Enter" && !e.altKey) {
                e.preventDefault();
                this.sendMessage();
            }
        };

        this.selectors.sendButton.onclick = () => {
            this.sendMessage();
        };
    }

    createElementFromTemplate(template) {
        const container = document.createElement("div");
        container.innerHTML = template.trim();
        return container.firstChild;
    }

    toggleWindow() {
        if (this.selectors.window.classList.contains("hidden")) {
            this.selectors.bubble.innerHTML = chatCloseIcon;
            this.selectors.window.style.display = "flex";
            setTimeout(() => {
                this.selectors.window.style.transform = "scale(1)";
                this.selectors.window.style.opacity = "1";
            }, 20);

            this.selectors.window.classList.remove("hidden");
            this.scrollToLastMessage();
        } else {
            this.selectors.window.style.transform = "scale(0.95)";
            this.selectors.window.style.opacity = "0";

            setTimeout(() => {
                this.selectors.window.style.display = "none";
                this.selectors.window.classList.add("hidden");
            }, 300);
            this.selectors.bubble.innerHTML = chatIcon;
        }
    }

    async sendMessage() {
        const prompt = this.selectors.input.value;
        if (prompt.trim() === "") return;

        this.state.waitingResponse = true;
        this.selectors.input.value = "";

        this.createChatMessage(prompt, "user");

        let data;
        if (this.state.redirectToHuman) {
            data = await this.fetch.sendContactData(this.state.chat.id, prompt, this.config.supportEmail);
        } else {
            data = await this.fetch.sendMessage(this.state.chat.id, prompt);
        }
        if (!data) {
            return this.createChatMessage("Something went wrong", "assistant-err");
        }

        if (("redirect" in data && data.redirect) || ("validMail" in data && data.validEmail)) {
            this.state.redirectToHuman = true;
        }

        this.createChatMessage(data.response, "assistant");
        this.state.waitingResponse = false;
    }
}

window.Hainzelman = {
    Widget: HainzelmanWidget
};

// Import fonts
let link = document.createElement("link");
link.setAttribute("rel", "stylesheet");
link.setAttribute("type", "text/css");
link.setAttribute(
    "href",
    "https://fonts.googleapis.com/css2?family=Roboto:ital,wght@0,100..900;1,100..900&display=swap"
);
document.head.appendChild(link);

// SVG Icons

const chatIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="28" height="28" viewBox="0 0 38 38" fill="none">
<path d="M0.666504 37.3332V4.33317C0.666504 3.32484 1.02553 2.46164 1.74359 1.74359C2.46164 1.02553 3.32484 0.666504 4.33317 0.666504H33.6665C34.6748 0.666504 35.538 1.02553 36.2561 1.74359C36.9741 2.46164 37.3332 3.32484 37.3332 4.33317V26.3332C37.3332 27.3415 36.9741 28.2047 36.2561 28.9228C35.538 29.6408 34.6748 29.9998 33.6665 29.9998H7.99984L0.666504 37.3332Z" fill="#009C9D"/>
</svg>`;

const chatCloseIcon = `
<svg xmlns="http://www.w3.org/2000/svg" width="67" height="67" viewBox="0 0 67 67" fill="none">
<path d="M25.125 50.25L41.875 33.5L25.125 16.75" stroke="#009C9D" stroke-width="4" stroke-linecap="round" stroke-linejoin="round"/>
</svg>`;

const globeIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="34" height="34" viewBox="0 0 34 34" fill="none">
<path d="M17 33.6668C14.7222 33.6668 12.5694 33.2293 10.5416 32.3543C8.51387 31.4793 6.74304 30.2849 5.22915 28.771C3.71526 27.2571 2.52081 25.4863 1.64581 23.4585C0.770813 21.4307 0.333313 19.2779 0.333313 17.0002C0.333313 14.6946 0.770813 12.5349 1.64581 10.521C2.52081 8.50711 3.71526 6.74322 5.22915 5.22933C6.74304 3.71544 8.51387 2.521 10.5416 1.646C12.5694 0.770996 14.7222 0.333496 17 0.333496C19.3055 0.333496 21.4653 0.770996 23.4791 1.646C25.493 2.521 27.2569 3.71544 28.7708 5.22933C30.2847 6.74322 31.4791 8.50711 32.3541 10.521C33.2291 12.5349 33.6666 14.6946 33.6666 17.0002C33.6666 19.2779 33.2291 21.4307 32.3541 23.4585C31.4791 25.4863 30.2847 27.2571 28.7708 28.771C27.2569 30.2849 25.493 31.4793 23.4791 32.3543C21.4653 33.2293 19.3055 33.6668 17 33.6668ZM17 30.2502C17.7222 29.2502 18.3472 28.2085 18.875 27.1252C19.4028 26.0418 19.8333 24.8891 20.1666 23.6668H13.8333C14.1666 24.8891 14.5972 26.0418 15.125 27.1252C15.6528 28.2085 16.2778 29.2502 17 30.2502ZM12.6666 29.5835C12.1666 28.6668 11.7291 27.7154 11.3541 26.7293C10.9791 25.7432 10.6666 24.7224 10.4166 23.6668H5.49998C6.30554 25.0557 7.31248 26.2641 8.52081 27.2918C9.72915 28.3196 11.1111 29.0835 12.6666 29.5835ZM21.3333 29.5835C22.8889 29.0835 24.2708 28.3196 25.4791 27.2918C26.6875 26.2641 27.6944 25.0557 28.5 23.6668H23.5833C23.3333 24.7224 23.0208 25.7432 22.6458 26.7293C22.2708 27.7154 21.8333 28.6668 21.3333 29.5835ZM4.08331 20.3335H9.74998C9.66665 19.7779 9.60415 19.2293 9.56248 18.6877C9.52081 18.146 9.49998 17.5835 9.49998 17.0002C9.49998 16.4168 9.52081 15.8543 9.56248 15.3127C9.60415 14.771 9.66665 14.2224 9.74998 13.6668H4.08331C3.94442 14.2224 3.84026 14.771 3.77081 15.3127C3.70137 15.8543 3.66665 16.4168 3.66665 17.0002C3.66665 17.5835 3.70137 18.146 3.77081 18.6877C3.84026 19.2293 3.94442 19.7779 4.08331 20.3335ZM13.0833 20.3335H20.9166C21 19.7779 21.0625 19.2293 21.1041 18.6877C21.1458 18.146 21.1666 17.5835 21.1666 17.0002C21.1666 16.4168 21.1458 15.8543 21.1041 15.3127C21.0625 14.771 21 14.2224 20.9166 13.6668H13.0833C13 14.2224 12.9375 14.771 12.8958 15.3127C12.8541 15.8543 12.8333 16.4168 12.8333 17.0002C12.8333 17.5835 12.8541 18.146 12.8958 18.6877C12.9375 19.2293 13 19.7779 13.0833 20.3335ZM24.25 20.3335H29.9166C30.0555 19.7779 30.1597 19.2293 30.2291 18.6877C30.2986 18.146 30.3333 17.5835 30.3333 17.0002C30.3333 16.4168 30.2986 15.8543 30.2291 15.3127C30.1597 14.771 30.0555 14.2224 29.9166 13.6668H24.25C24.3333 14.2224 24.3958 14.771 24.4375 15.3127C24.4791 15.8543 24.5 16.4168 24.5 17.0002C24.5 17.5835 24.4791 18.146 24.4375 18.6877C24.3958 19.2293 24.3333 19.7779 24.25 20.3335ZM23.5833 10.3335H28.5C27.6944 8.94461 26.6875 7.73627 25.4791 6.7085C24.2708 5.68072 22.8889 4.91683 21.3333 4.41683C21.8333 5.3335 22.2708 6.28488 22.6458 7.271C23.0208 8.25711 23.3333 9.27794 23.5833 10.3335ZM13.8333 10.3335H20.1666C19.8333 9.11127 19.4028 7.9585 18.875 6.87516C18.3472 5.79183 17.7222 4.75016 17 3.75016C16.2778 4.75016 15.6528 5.79183 15.125 6.87516C14.5972 7.9585 14.1666 9.11127 13.8333 10.3335ZM5.49998 10.3335H10.4166C10.6666 9.27794 10.9791 8.25711 11.3541 7.271C11.7291 6.28488 12.1666 5.3335 12.6666 4.41683C11.1111 4.91683 9.72915 5.68072 8.52081 6.7085C7.31248 7.73627 6.30554 8.94461 5.49998 10.3335Z" fill="#009C9D"/>
</svg>`;

const globeErrorIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="40" height="40" viewBox="0 0 40 40" fill="none">
<path d="M19.9999 36.6668C17.7221 36.6668 15.5694 36.2293 13.5416 35.3543C11.5138 34.4793 9.74297 33.2849 8.22909 31.771C6.7152 30.2571 5.52075 28.4863 4.64575 26.4585C3.77075 24.4307 3.33325 22.2779 3.33325 20.0002C3.33325 17.6946 3.77075 15.5349 4.64575 13.521C5.52075 11.5071 6.7152 9.74322 8.22909 8.22933C9.74297 6.71544 11.5138 5.521 13.5416 4.646C15.5694 3.771 17.7221 3.3335 19.9999 3.3335C22.3055 3.3335 24.4652 3.771 26.4791 4.646C28.493 5.521 30.2569 6.71544 31.7708 8.22933C33.2846 9.74322 34.4791 11.5071 35.3541 13.521C36.2291 15.5349 36.6666 17.6946 36.6666 20.0002C36.6666 22.2779 36.2291 24.4307 35.3541 26.4585C34.4791 28.4863 33.2846 30.2571 31.7708 31.771C30.2569 33.2849 28.493 34.4793 26.4791 35.3543C24.4652 36.2293 22.3055 36.6668 19.9999 36.6668ZM19.9999 33.2502C20.7221 32.2502 21.3471 31.2085 21.8749 30.1252C22.4027 29.0418 22.8333 27.8891 23.1666 26.6668H16.8333C17.1666 27.8891 17.5971 29.0418 18.1249 30.1252C18.6527 31.2085 19.2777 32.2502 19.9999 33.2502ZM15.6666 32.5835C15.1666 31.6668 14.7291 30.7154 14.3541 29.7293C13.9791 28.7432 13.6666 27.7224 13.4166 26.6668H8.49992C9.30547 28.0557 10.3124 29.2641 11.5208 30.2918C12.7291 31.3196 14.111 32.0835 15.6666 32.5835ZM24.3333 32.5835C25.8888 32.0835 27.2708 31.3196 28.4791 30.2918C29.6874 29.2641 30.6944 28.0557 31.4999 26.6668H26.5833C26.3333 27.7224 26.0208 28.7432 25.6458 29.7293C25.2708 30.7154 24.8333 31.6668 24.3333 32.5835ZM7.08325 23.3335H12.7499C12.6666 22.7779 12.6041 22.2293 12.5624 21.6877C12.5208 21.146 12.4999 20.5835 12.4999 20.0002C12.4999 19.4168 12.5208 18.8543 12.5624 18.3127C12.6041 17.771 12.6666 17.2224 12.7499 16.6668H7.08325C6.94436 17.2224 6.8402 17.771 6.77075 18.3127C6.70131 18.8543 6.66659 19.4168 6.66659 20.0002C6.66659 20.5835 6.70131 21.146 6.77075 21.6877C6.8402 22.2293 6.94436 22.7779 7.08325 23.3335ZM16.0833 23.3335H23.9166C23.9999 22.7779 24.0624 22.2293 24.1041 21.6877C24.1458 21.146 24.1666 20.5835 24.1666 20.0002C24.1666 19.4168 24.1458 18.8543 24.1041 18.3127C24.0624 17.771 23.9999 17.2224 23.9166 16.6668H16.0833C15.9999 17.2224 15.9374 17.771 15.8958 18.3127C15.8541 18.8543 15.8333 19.4168 15.8333 20.0002C15.8333 20.5835 15.8541 21.146 15.8958 21.6877C15.9374 22.2293 15.9999 22.7779 16.0833 23.3335ZM27.2499 23.3335H32.9166C33.0555 22.7779 33.1596 22.2293 33.2291 21.6877C33.2985 21.146 33.3333 20.5835 33.3333 20.0002C33.3333 19.4168 33.2985 18.8543 33.2291 18.3127C33.1596 17.771 33.0555 17.2224 32.9166 16.6668H27.2499C27.3333 17.2224 27.3958 17.771 27.4374 18.3127C27.4791 18.8543 27.4999 19.4168 27.4999 20.0002C27.4999 20.5835 27.4791 21.146 27.4374 21.6877C27.3958 22.2293 27.3333 22.7779 27.2499 23.3335ZM26.5833 13.3335H31.4999C30.6944 11.9446 29.6874 10.7363 28.4791 9.7085C27.2708 8.68072 25.8888 7.91683 24.3333 7.41683C24.8333 8.3335 25.2708 9.28488 25.6458 10.271C26.0208 11.2571 26.3333 12.2779 26.5833 13.3335ZM16.8333 13.3335H23.1666C22.8333 12.1113 22.4027 10.9585 21.8749 9.87516C21.3471 8.79183 20.7221 7.75016 19.9999 6.75016C19.2777 7.75016 18.6527 8.79183 18.1249 9.87516C17.5971 10.9585 17.1666 12.1113 16.8333 13.3335ZM8.49992 13.3335H13.4166C13.6666 12.2779 13.9791 11.2571 14.3541 10.271C14.7291 9.28488 15.1666 8.3335 15.6666 7.41683C14.111 7.91683 12.7291 8.68072 11.5208 9.7085C10.3124 10.7363 9.30547 11.9446 8.49992 13.3335Z" fill="#FF0000"/>
</svg>`;

const personIcon = `<svg xmlns="http://www.w3.org/2000/svg" width="37" height="34" viewBox="0 0 37 34" fill="none">
<path d="M18.5 17.0002C15.9792 17.0002 13.8212 16.1842 12.0261 14.5522C10.2309 12.9203 9.33335 10.9585 9.33335 8.66683C9.33335 6.37516 10.2309 4.41336 12.0261 2.78141C13.8212 1.14947 15.9792 0.333496 18.5 0.333496C21.0209 0.333496 23.1788 1.14947 24.974 2.78141C26.7691 4.41336 27.6667 6.37516 27.6667 8.66683C27.6667 10.9585 26.7691 12.9203 24.974 14.5522C23.1788 16.1842 21.0209 17.0002 18.5 17.0002ZM0.166687 33.6668V27.8335C0.166687 26.6529 0.500888 25.5679 1.16929 24.5783C1.83769 23.5887 2.72571 22.8335 3.83335 22.3127C6.20141 21.2363 8.60766 20.429 11.0521 19.8908C13.4965 19.3526 15.9792 19.0835 18.5 19.0835C21.0209 19.0835 23.5035 19.3526 25.9479 19.8908C28.3924 20.429 30.7986 21.2363 33.1667 22.3127C34.2743 22.8335 35.1623 23.5887 35.8307 24.5783C36.4991 25.5679 36.8334 26.6529 36.8334 27.8335V33.6668H0.166687ZM4.75002 29.5002H32.25V27.8335C32.25 27.4516 32.145 27.1043 31.9349 26.7918C31.7248 26.4793 31.4479 26.2363 31.1042 26.0627C29.0417 25.1252 26.9601 24.422 24.8594 23.9533C22.7587 23.4845 20.6389 23.2502 18.5 23.2502C16.3611 23.2502 14.2413 23.4845 12.1406 23.9533C10.04 24.422 7.95835 25.1252 5.89585 26.0627C5.5521 26.2363 5.27519 26.4793 5.06512 26.7918C4.85505 27.1043 4.75002 27.4516 4.75002 27.8335V29.5002ZM18.5 12.8335C19.7604 12.8335 20.8394 12.4255 21.737 11.6095C22.6346 10.7936 23.0834 9.81266 23.0834 8.66683C23.0834 7.521 22.6346 6.54009 21.737 5.72412C20.8394 4.90815 19.7604 4.50016 18.5 4.50016C17.2396 4.50016 16.1606 4.90815 15.263 5.72412C14.3655 6.54009 13.9167 7.521 13.9167 8.66683C13.9167 9.81266 14.3655 10.7936 15.263 11.6095C16.1606 12.4255 17.2396 12.8335 18.5 12.8335Z" fill="#787A7E"/>
</svg>`;

const sendIcon = `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="76" height="64" viewBox="0 0 76 64" fill="none">
<rect width="76" height="64" fill="url(#pattern0_186_674)"/>
<defs>
<pattern id="pattern0_186_674" patternContentUnits="objectBoundingBox" width="1" height="1">
<use xlink:href="#image0_186_674" transform="matrix(0.0100251 0 0 0.0119048 -0.00125313 0)"/>
</pattern>
<image id="image0_186_674" width="100" height="84" xlink:href="data:image/png;base64,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"/>
</defs>
</svg>`;
