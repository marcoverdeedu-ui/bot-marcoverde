const express = require('express');
const axios = require('axios');
const app = express();
app.use(express.json());

// Variáveis de Ambiente (Configuradas no Render)
const GEMINI_API_KEY = process.env.GEMINI_API_KEY || "";
const WHATSAPP_TOKEN = process.env.WHATSAPP_TOKEN || "";
const PHONE_NUMBER_ID = process.env.PHONE_NUMBER_ID || "";
const VERIFY_TOKEN = process.env.VERIFY_TOKEN || "marco_verde_secret_token";

const SYSTEM_PROMPT = `Atue como o Professor Marco Verde, um instrutor de tecnologia acolhedor, extremamente paciente e focado no público idoso (60+ anos).

DIRETRIZES DE COMUNICAÇÃO:
1. Trate o aluno com respeito, carinho e empatia. Evite termos técnicos difíceis sem explicação.
2. Formate as respostas usando *asteriscos* para negrito em botões e nomes de aplicativos no WhatsApp.
3. Organize cada explicação no seguinte padrão:
   - 🟢 *Resumo Amigável:* Explicação curta em 1 ou 2 frases sobre a função.
   - 📱 *Passo a Passo:* Guia numerado e simples indicando exatamente onde tocar no celular.
   - 🛡️ *Dica de Ouro:* Um conselho prático de segurança ou incentivo.
4. Se o usuário enviar um texto suspeito de golpe, alerte imediatamente com 🚨 ALERTA DE GOLPE! e oriente o que ele deve fazer.`;

// 1. Validação do Webhook pela Meta
app.get('/webhook', (req, res) => {
    if (req.query['hub.mode'] === 'subscribe' && req.query['hub.verify_token'] === VERIFY_TOKEN) {
        return res.status(200).send(req.query['hub.challenge']);
    }
    res.sendStatus(403);
});

// 2. Recebimento de Mensagens
app.post('/webhook', async (req, res) => {
    const entry = req.body.entry?.[0]?.changes?.[0]?.value?.messages?.[0];
    if (entry && entry.type === 'text') {
        const from = entry.from;
        const text = entry.text.body;
        const reply = await askGemini(text);
        await sendWhatsApp(from, reply);
    }
    res.status(200).send('OK');
});

// 3. Consulta à API do Gemini 2.5 Flash
async function askGemini(prompt, retries = 5, delay = 1000) {
    const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash-preview-09-2025:generateContent?key=${GEMINI_API_KEY}`;
    for (let i = 0; i < retries; i++) {
        try {
            const resp = await axios.post(url, {
                contents: [{ parts: [{ text: prompt }] }],
                systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] }
            });
            return resp.data.candidates[0].content.parts[0].text;
        } catch(e) {}
        await new Promise(r => setTimeout(r, delay));
        delay *= 2; // Exponential Backoff
    }
    return "🟢 *Olá! Aqui é o Professor Marco.* \n\nTive uma pequena oscilação na conexão. Pode repetir a sua dúvida com calma?";
}

// 4. Envio da resposta via Graph API do WhatsApp
async function sendWhatsApp(to, text) {
    await axios.post(`https://graph.facebook.com/v19.0/${PHONE_NUMBER_ID}/messages`, {
        messaging_product: "whatsapp",
        to: to,
        type: "text",
        text: { body: text }
    }, { headers: { 'Authorization': `Bearer ${WHATSAPP_TOKEN}` } });
}

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Servidor a rodar na porta ${PORT}`));
