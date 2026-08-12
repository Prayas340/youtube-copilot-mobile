import sys
import json
import re
import urllib.request
from youtube_transcript_api import YouTubeTranscriptApi, TranscriptsDisabled, NoTranscriptFound

def extract_video_id(url_or_id):
    if not url_or_id:
        return None
    url_or_id = url_or_id.strip()
    if re.match(r'^[a-zA-Z0-9_-]{11}$', url_or_id):
        return url_or_id
    pattern = r'(?:v=|\/shorts\/|\/embed\/|youtu\.be\/)([a-zA-Z0-9_-]{11})'
    match = re.search(pattern, url_or_id)
    return match.group(1) if match else None

def format_seconds(seconds):
    secs_int = int(seconds)
    hours = secs_int // 3600
    mins = (secs_int % 3600) // 60
    secs = secs_int % 60
    if hours > 0:
        return f"{hours:02d}:{mins:02d}:{secs:02d}"
    return f"{mins:02d}:{secs:02d}"

def fetch_metadata(video_id):
    url = f"https://www.youtube.com/watch?v={video_id}"
    meta = {
        "title": f"YouTube Video ({video_id})",
        "channel": "YouTube Creator",
        "description": "",
        "tags": [],
        "view_count": None
    }
    try:
        req = urllib.request.Request(f"https://www.youtube.com/oembed?url={url}&format=json", headers={'User-Agent': 'Mozilla/5.0'})
        with urllib.request.urlopen(req, timeout=3) as resp:
            data = json.loads(resp.read().decode())
            meta["title"] = data.get("title", meta["title"])
            meta["channel"] = data.get("author_name", meta["channel"])
    except Exception:
        pass

    try:
        import yt_dlp
        ydl_opts = {'skip_download': True, 'quiet': True, 'no_warnings': True}
        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            meta["title"] = info.get("title", meta["title"])
            meta["channel"] = info.get("uploader", info.get("channel", meta["channel"]))
            meta["description"] = info.get("description", "")
            meta["tags"] = info.get("tags", [])
            meta["view_count"] = info.get("view_count", None)
    except Exception:
        pass

    return meta

def get_video_package_json(url_or_id):
    video_id = extract_video_id(url_or_id)
    if not video_id:
        return {"error": "Invalid YouTube URL or Video ID"}

    metadata = fetch_metadata(video_id)
    formatted_items = []
    
    try:
        try:
            raw_transcript = YouTubeTranscriptApi.get_transcript(video_id)
        except (TranscriptsDisabled, NoTranscriptFound):
            transcript_list = YouTubeTranscriptApi.list_transcripts(video_id)
            try:
                transcript = transcript_list.find_transcript(['en', 'en-US', 'en-GB'])
            except Exception:
                transcript = transcript_list.find_generated_transcript(['en'])
            raw_transcript = transcript.fetch()

        for entry in raw_transcript:
            start_sec = int(entry.get('start', 0))
            formatted_items.append({
                "text": entry.get("text", "").strip(),
                "start": start_sec,
                "formatted_time": format_seconds(start_sec),
                "url": f"https://www.youtube.com/watch?v={video_id}&t={start_sec}s"
            })

    except Exception:
        formatted_items = []

    return {
        "video_id": video_id,
        "metadata": metadata,
        "count": len(formatted_items),
        "transcript": formatted_items
    }

if __name__ == "__main__":
    if len(sys.argv) > 1:
        target = sys.argv[1]
        res = get_video_package_json(target)
        print(json.dumps(res))
    else:
        print(json.dumps({"error": "No URL provided"}))
