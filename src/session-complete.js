const CURIOSITY_KEY = 'sakha_curiosity_ratings';

function saveCuriosityRating(conceptId, rating) {
    if (!conceptId) return;
    let ratings = {};
    try {
        ratings = JSON.parse(localStorage.getItem(CURIOSITY_KEY) || '{}') || {};
    } catch (_) {
        ratings = {};
    }
    ratings[conceptId] = {
        rating,
        ratedAt: new Date().toISOString()
    };
    localStorage.setItem(CURIOSITY_KEY, JSON.stringify(ratings));
}

export function showSessionCompleteModal({ conceptTitle, teachBackText, conceptId, language, onReturn }) {
    const english = language === 'English';
    const overlay = document.createElement('div');
    overlay.className = 'session-complete-overlay';

    const card = document.createElement('div');
    card.className = 'session-complete-card';

    const stars = document.createElement('div');
    stars.className = 'stars';
    stars.textContent = '***';

    const heading = document.createElement('h2');
    heading.textContent = english ? 'Great job!' : 'Wah yaar!';

    const result = document.createElement('p');
    const strong = document.createElement('strong');
    strong.textContent = conceptTitle;
    result.append(strong, english ? ' understood!' : ' samajh aaya!');

    const note = document.createElement('p');
    note.className = 'session-complete-note';
    note.textContent = english ? 'Now you can explain this idea in your own words.' : 'Ab tum is idea ko apne words mein explain kar sakte ho.';

    const rating = document.createElement('div');
    rating.className = 'curiosity-rating';
    const ratingLabel = document.createElement('p');
    ratingLabel.textContent = english ? 'Was this topic interesting?' : 'Topic interesting laga?';
    const ratingChoices = document.createElement('div');
    ratingChoices.className = 'curiosity-rating-choices';
    [
        ['1', english ? 'Not yet' : 'Abhi nahi'],
        ['3', english ? 'Okay' : 'Theek'],
        ['5', english ? 'Very' : 'Bahut']
    ].forEach(([value, label]) => {
        const button = document.createElement('button');
        button.type = 'button';
        button.textContent = label;
        button.addEventListener('click', () => {
            saveCuriosityRating(conceptId, Number(value));
            [...ratingChoices.querySelectorAll('button')].forEach((item) => item.disabled = true);
            ratingLabel.textContent = english ? 'Saved on this device.' : 'Is device par save ho gaya.';
        });
        ratingChoices.appendChild(button);
    });
    rating.append(ratingLabel, ratingChoices);

    const returnButton = document.createElement('button');
    returnButton.id = 'returnToGalaxyBtn';
    returnButton.textContent = 'Choose another topic';

    const shareButton = document.createElement('button');
    shareButton.id = 'shareResultBtn';
    shareButton.className = 'share-btn';
    shareButton.textContent = 'Share progress card';

    card.append(stars, heading, result, note, rating, returnButton, shareButton);
    overlay.appendChild(card);
    document.body.appendChild(overlay);

    returnButton.onclick = () => {
        overlay.remove();
        onReturn?.();
    };
    shareButton.onclick = () => shareProgressCard(conceptTitle, teachBackText);
}

function shareProgressCard(conceptTitle, teachBackText) {
    const studentName = localStorage.getItem('sakha_name') || 'A student';
    const dataUrl = generateSummaryCard(studentName, conceptTitle, teachBackText);

    fetch(dataUrl)
        .then((res) => res.blob())
        .then((blob) => {
            const file = new File([blob], 'sakha-progress.png', { type: 'image/png' });
            if (navigator.canShare && navigator.canShare({ files: [file] })) {
                navigator.share({
                    title: 'Sakha AI Study Buddy',
                    text: 'Check out what ' + studentName + ' just learned on Sakha.',
                    files: [file]
                });
            } else {
                const a = document.createElement('a');
                a.href = dataUrl;
                a.download = 'sakha-progress.png';
                a.click();
                alert('Card downloaded. You can share it from your device.');
            }
        });
}

function generateSummaryCard(studentName, conceptTitle, teachBackText) {
    const canvas = document.createElement('canvas');
    canvas.width = 800;
    canvas.height = 600;
    const ctx = canvas.getContext('2d');

    const grad = ctx.createLinearGradient(0, 0, 800, 600);
    grad.addColorStop(0, '#12372a');
    grad.addColorStop(1, '#245953');
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 800, 600);

    ctx.font = 'bold 36px system-ui, sans-serif';
    ctx.fillStyle = '#dff7e2';
    ctx.fillText(studentName + ' understood:', 60, 120);

    ctx.font = 'bold 48px system-ui, sans-serif';
    ctx.fillStyle = '#ffffff';
    ctx.fillText(conceptTitle, 60, 190);

    ctx.font = '24px system-ui, sans-serif';
    ctx.fillStyle = '#d7e8df';
    ctx.fillText('"' + teachBackText.substring(0, 60) + '..."', 60, 280);

    ctx.font = 'bold 20px system-ui, sans-serif';
    ctx.fillStyle = '#ffd166';
    ctx.fillText('Sakha - AI Study Buddy', 60, 550);

    return canvas.toDataURL('image/png');
}