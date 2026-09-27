const textInput = document.getElementById('textInput');
const colorPicker = document.getElementById('colorPicker');
const fontSizeSlider = document.getElementById('fontSizeSlider');
const shadowToggle = document.getElementById('shadowToggle');
const preview = document.getElementById('preview');
const colorSample = document.getElementById('colorSample');
const colorText = document.getElementById('colorText');
const fontSizeValue = document.getElementById('fontSizeValue');

function updatePreview() {
    preview.textContent = textInput.value || 'Sonic';
    preview.style.color = colorPicker.value;
    preview.style.fontSize = fontSizeSlider.value + 'px';

    if (shadowToggle.checked) {
        preview.style.textShadow = `0 0 20px rgba(${hexToRgb(colorPicker.value).join(', ')}, 0.5)`;
    } else {
        preview.style.textShadow = 'none';
    }
}

function hexToRgb(hex) {
    const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
    return result ? [
        parseInt(result[1], 16),
        parseInt(result[2], 16),
        parseInt(result[3], 16)
    ] : [0, 0, 0];
}

textInput.addEventListener('input', updatePreview);

colorPicker.addEventListener('input', (e) => {
    colorSample.style.backgroundColor = e.target.value;
    colorText.textContent = e.target.value.toUpperCase();
    updatePreview();
});

fontSizeSlider.addEventListener('input', (e) => {
    fontSizeValue.textContent = e.target.value;
    updatePreview();
});

shadowToggle.addEventListener('change', updatePreview);

async function exportAsImage() {
    try {
        const canvas = await html2canvas(preview, {
            backgroundColor: null,
            scale: 2,
            logging: false,
            useCORS: true,
            allowTaint: true
        });

        const link = document.createElement('a');
        link.href = canvas.toDataURL('image/png');
        link.download = 'sonic-text.png';
        link.click();

        showMessage('PNG exported successfully!');
    } catch (error) {
        console.error('Export error:', error);
        showMessage('Error exporting PNG', 'error');
    }
}

function downloadFont() {
    try {
        const link = document.createElement('a');
        link.href = 'assets/SonicTitle.ttf';
        link.download = 'SonicTitle.ttf';
        link.click();

        showMessage('Font file downloading...');
    } catch (error) {
        console.error('Download error:', error);
        showMessage('Error downloading font', 'error');
    }
}

function downloadExtension() {
    try {
        const link = document.createElement('a');
        link.href = 'assets/SonicTitle.zip';
        link.download = 'SonicTitle-Extension.zip';
        link.click();

        showMessage('Extension downloaded!');
    } catch (error) {
        console.error('Download error:', error);
        showMessage('Error downloading extension', 'error');
    }
}

function resetGenerator() {
    textInput.value = 'Sonic';
    colorPicker.value = '#00ff00';
    fontSizeSlider.value = '80';
    colorSample.style.backgroundColor = '#00ff00';
    colorText.textContent = '#00ff00';
    fontSizeValue.textContent = '80';
    shadowToggle.checked = true;
    updatePreview();
    showMessage('Reset to default settings');
}

function showMessage(message, type = 'success') {
    const statusDiv = document.createElement('div');
    statusDiv.className = `status-message ${type === 'error' ? 'error' : ''}`;
    statusDiv.textContent = message;
    document.body.appendChild(statusDiv);

    setTimeout(() => {
        statusDiv.style.animation = 'slide-in 0.3s ease-out reverse';
        setTimeout(() => statusDiv.remove(), 300);
    }, 2500);
}

// Initialize preview
updatePreview();
