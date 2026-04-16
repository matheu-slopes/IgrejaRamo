import { NextResponse } from "next/server";

const CHANNEL_ID = "UCxVJzTbWMncD0-QJTpYenoQ";

const RSS_URL = `https://www.youtube.com/feeds/videos.xml?channel_id=${CHANNEL_ID}`;

interface LatestVideo {
  title: string;
  url: string;
  thumbnail: string;
  published: string;
}

export async function GET() {
  try {
    const res = await fetch(RSS_URL, { next: { revalidate: 600 } }); // cache 10 min
    if (!res.ok) throw new Error("Failed to fetch RSS");

    const xml = await res.text();

    // Parse first <entry> from the Atom feed
    const entryMatch = xml.match(/<entry>([\s\S]*?)<\/entry>/);
    if (!entryMatch) {
      return NextResponse.json({ video: null }, { status: 200 });
    }

    const entry = entryMatch[1];
    const title = entry.match(/<title>([\s\S]*?)<\/title>/)?.[1] ?? "";
    const videoId = entry.match(/<yt:videoId>([\s\S]*?)<\/yt:videoId>/)?.[1] ?? "";
    const published = entry.match(/<published>([\s\S]*?)<\/published>/)?.[1] ?? "";

    const video: LatestVideo = {
      title,
      url: `https://www.youtube.com/watch?v=${videoId}`,
      thumbnail: `https://i.ytimg.com/vi/${videoId}/hqdefault.jpg`,
      published,
    };

    return NextResponse.json({ video });
  } catch {
    return NextResponse.json({ video: null }, { status: 200 });
  }
}
