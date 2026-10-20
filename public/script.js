async function fetchChannels() {
    const response = await fetch('/api/channels');
    const channels = await response.json();
    const grid = document.getElementById('channels-grid');
    grid.innerHTML = '';

    channels.forEach(channel => {
        const div = document.createElement('div');
        div.className = 'bg-gray-800 p-4 rounded-lg cursor-pointer hover:bg-gray-700';
        div.innerHTML = `<img src="${channel.logo}" class="w-full h-32 object-contain mb-2">
                         <h2 class="text-sm font-semibold truncate">${channel.Name}</h2>`;
        div.onclick = () => playChannel(channel.playback_url);
        grid.appendChild(div);
    });
}

function playChannel(url) {
    const video = document.getElementById('video');
    const container = document.getElementById('player-container');
    container.classList.remove('hidden');

    const streamUrl = `/api/proxy/live?url=${encodeURIComponent(url)}`;
    
    if (Hls.isSupported()) {
        const hls = new Hls();
        hls.loadSource(streamUrl);
        hls.attachMedia(video);
        hls.on(Hls.Events.MANIFEST_PARSED, () => video.play());
    } else if (video.canPlayType('application/vnd.apple.mpegurl')) {
        video.src = streamUrl;
        video.addEventListener('loadedmetadata', () => video.play());
    }
}

function closePlayer() {
    const video = document.getElementById('video');
    video.pause();
    document.getElementById('player-container').classList.add('hidden');
}

fetchChannels();
