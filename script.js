import { CreateMLCEngine } from "https://esm.run/@mlc-ai/web-llm";

// Variables UI
const form = document.getElementById('analyze-form');
const loadingPanel = document.getElementById('model-loading-panel');
const progressBar = document.getElementById('progress-bar');
const loadingText = document.getElementById('loading-text');

let engine = null;

// Función para inicializar el modelo
async function initModel() {
    try {
        const selectedModel = "Qwen2-0.5B-Instruct-q4f16_1-MLC";
        
        const initProgressCallback = (report) => {
            loadingText.textContent = report.text;
            progressBar.style.width = `${report.progress * 100}%`;
        };

        engine = await CreateMLCEngine(
            selectedModel,
            { initProgressCallback: initProgressCallback }
        );

        // Modelo cargado
        loadingPanel.style.display = 'none';
        form.style.display = 'block';
    } catch (error) {
        loadingText.textContent = "Error al cargar el modelo. ¿Tu navegador soporta WebGPU?";
        loadingText.style.color = "var(--bearish)";
        console.error(error);
    }
}

// Iniciar carga del modelo automáticamente al abrir
initModel();

// UX Tabs y Archivos
const tabs = document.querySelectorAll('.tab-btn');
const urlContainer = document.getElementById('url-container');
const fileContainer = document.getElementById('file-container');
const urlInput = document.getElementById('url-input');
const fileInput = document.getElementById('file-input');
const fileMsg = document.querySelector('.file-msg');

tabs.forEach(tab => {
    tab.addEventListener('click', () => {
        tabs.forEach(t => t.classList.remove('active'));
        tab.classList.add('active');
        
        if (tab.dataset.tab === 'url') {
            urlContainer.style.display = 'block';
            fileContainer.style.display = 'none';
            fileInput.value = '';
            fileMsg.textContent = 'Arrastra tu archivo aquí o haz clic para subir';
        } else {
            urlContainer.style.display = 'none';
            fileContainer.style.display = 'block';
            urlInput.value = '';
        }
    });
});

fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
        fileMsg.textContent = e.target.files[0].name;
        fileMsg.style.color = 'var(--primary-color)';
    } else {
        fileMsg.textContent = 'Arrastra tu archivo aquí o haz clic para subir';
        fileMsg.style.color = 'var(--text-muted)';
    }
});

// Función para extraer texto puro del HTML
function extractTextFromHTML(htmlString) {
    const parser = new DOMParser();
    const doc = parser.parseFromString(htmlString, 'text/html');
    return doc.body.textContent || "";
}

// Analizar Documento
const submitBtn = document.getElementById('submit-btn');
const btnText = document.querySelector('.btn-text');
const loader = document.querySelector('.loader');
const resultContainer = document.getElementById('result-container');
const sentimentBadge = document.getElementById('sentiment-badge');
const resultText = document.getElementById('result-text');

form.addEventListener('submit', async (e) => {
    e.preventDefault();
    
    if (!urlInput.value && (!fileInput.files || fileInput.files.length === 0)) {
        alert('Por favor introduce un enlace o sube un archivo.');
        return;
    }

    if (!engine) {
        alert('El modelo aún se está cargando.');
        return;
    }

    // UI a estado de carga
    submitBtn.disabled = true;
    btnText.style.display = 'none';
    loader.style.display = 'block';
    resultContainer.classList.add('hidden');

    try {
        let rawText = "";

        if (urlInput.value) {
            // Usamos un proxy de CORS público porque GitHub Pages no permite peticiones cruzadas directas a la SEC
            const proxyUrl = `https://api.allorigins.win/get?url=${encodeURIComponent(urlInput.value)}`;
            const response = await fetch(proxyUrl);
            const data = await response.json();
            
            if (data.contents) {
                rawText = extractTextFromHTML(data.contents);
            } else {
                throw new Error("No se pudo obtener el contenido de la URL.");
            }
        } else {
            // Leer archivo localmente
            const file = fileInput.files[0];
            rawText = await new Promise((resolve, reject) => {
                const reader = new FileReader();
                reader.onload = (e) => resolve(extractTextFromHTML(e.target.result));
                reader.onerror = (e) => reject("Error al leer el archivo");
                reader.readAsText(file);
            });
        }

        if (!rawText.trim()) throw new Error("El documento parece estar vacío.");

        // Qwen2 0.5B contexto límite
        // Tomamos los primeros 4000 caracteres para análisis (MD&A o introducción)
        const snippet = rawText.substring(0, 4000);

        const messages = [
            { role: "system", content: "You are a financial analyst expert. Analyze the sentiment of the following excerpt from an SEC document. Output ONLY the sentiment (Bullish, Bearish, or Neutral) followed by a short 2-3 sentence explanation." },
            { role: "user", content: `Document Excerpt:\n\n${snippet}` }
        ];

        // Ejecutar inferencia en el navegador con WebGPU
        const reply = await engine.chat.completions.create({
            messages,
            temperature: 0.3,
            max_tokens: 150
        });

        const sentimentResult = reply.choices[0].message.content;
        showResult(sentimentResult);

    } catch (error) {
        console.error(error);
        showError(error.message || 'Error durante el análisis.');
    } finally {
        submitBtn.disabled = false;
        btnText.style.display = 'block';
        loader.style.display = 'none';
    }
});

function showResult(text) {
    resultContainer.classList.remove('hidden');
    resultText.textContent = text;
    
    const lowerText = text.toLowerCase();
    sentimentBadge.className = 'sentiment-badge';
    
    if (lowerText.includes('bullish') || lowerText.includes('alcista')) {
        sentimentBadge.textContent = 'BULLISH';
        sentimentBadge.classList.add('badge-bullish');
    } else if (lowerText.includes('bearish') || lowerText.includes('bajista')) {
        sentimentBadge.textContent = 'BEARISH';
        sentimentBadge.classList.add('badge-bearish');
    } else if (lowerText.includes('neutral')) {
        sentimentBadge.textContent = 'NEUTRAL';
        sentimentBadge.classList.add('badge-neutral');
    } else {
        sentimentBadge.textContent = 'ANALYZED';
        sentimentBadge.classList.add('badge-neutral');
    }
}

function showError(message) {
    resultContainer.classList.remove('hidden');
    sentimentBadge.className = 'sentiment-badge badge-error';
    sentimentBadge.textContent = 'ERROR';
    resultText.textContent = message;
}
