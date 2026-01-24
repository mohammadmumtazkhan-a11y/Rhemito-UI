const express = require('express');
const router = express.Router();

const DEEPSEEK_API_KEY = process.env.DEEPSEEK_API_KEY;
const DEEPSEEK_API_URL = 'https://api.deepseek.com/chat/completions';

router.post('/chat', async (req, res) => {
    if (!DEEPSEEK_API_KEY) {
        return res.status(500).json({ error: 'DeepSeek API key not configured' });
    }

    const { messages } = req.body;

    if (!messages || !Array.isArray(messages)) {
        return res.status(400).json({ error: 'Messages array is required' });
    }

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: messages,
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API Error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        res.json(data);
    } catch (error) {
        console.error('DeepSeek/Chat Error:', error);
        res.status(500).json({ error: 'Failed to communicate with DeepSeek AI' });
    }
});

router.post('/task', async (req, res) => {
    // Specialized endpoint for "Basic Tasks"
    // Expects: { task: "summarize", content: "..." } or similar
    if (!DEEPSEEK_API_KEY) {
        return res.status(500).json({ error: 'DeepSeek API key not configured' });
    }

    const { task, content } = req.body;
    let systemPrompt = "You are a helpful assistant.";

    if (task === 'summarize') {
        systemPrompt = "You are a helpful assistant. Summarize the following text concisely.";
    } else if (task === 'polish') {
        systemPrompt = "You are an editor. Rewrite the following text to be more professional and polished.";
    } else if (task === 'generate') {
        systemPrompt = "You are a creative writer. Generate content based on the user's request.";
    }

    try {
        const response = await fetch(DEEPSEEK_API_URL, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${DEEPSEEK_API_KEY}`
            },
            body: JSON.stringify({
                model: 'deepseek-chat',
                messages: [
                    { role: "system", content: systemPrompt },
                    { role: "user", content: content }
                ],
                stream: false
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`DeepSeek API Error: ${response.status} ${errorText}`);
        }

        const data = await response.json();
        res.json({ result: data.choices[0].message.content });
    } catch (error) {
        console.error('DeepSeek/Task Error:', error);
        res.status(500).json({ error: 'Failed to complete task' });
    }
});

module.exports = router;
