import Parser from 'rss-parser';
const parser = new Parser();

const RSS_URL = 'http://japan-backrooms-sandbox.wikidot.com/feed/pages/pagename/draft-list/category/draft%2Csharedpage/tags/-_category-b%2C_criticism-in/order/created_at+desc/limit/10/t/%E6%89%B9%E8%A9%95%E9%96%8B%E5%A7%8B%E4%B8%8B%E6%9B%B8%E3%81%8D';

export default {

    async fetch(request, env, ctx) {
        await this.scheduled(null, env, ctx);
        return new Response("Cron 処理を手動実行しました。Discord を確認してください。");
    },

    // Cron Trigger から呼び出されるハンドラ
    async scheduled(event, env, ctx) {
        const DISCORD_WEBHOOK_URL = env.DISCORD_WEBHOOK_URL;
        try {
            // 前回の取得内容を読み込む
            const oldHistoryRaw = await env.HISTORY_KV.get("previous_urls");
            let oldHistory = oldHistoryRaw ? JSON.parse(oldHistoryRaw) : [];

            // RSSフィードを取得
            const response = await fetch(RSS_URL, {
            headers: {
                "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            }
            });

            if (!response.ok) {
            throw new Error(`HTTPエラー! ステータス: ${response.status}`);
            }

            const xml = await response.text();
            console.log("取得データの一部:", xml.substring(0, 100));
            const feed = await parser.parseString(xml);
            const items = feed.items;

            // 履歴に含まれていないアイテムを抽出
            const newItems = items.filter(item => !oldHistory.includes(item.link));
            newItems.reverse();

            // 新着記事があればDiscordへ送信
            if (newItems.length > 0) {
                for (const item of newItems) {
                    // 著者名をHTML(item.content)から抽出
                    const content = item.content || '';
                    const authorMatch = content.match(/by <span class="printuser avatarhover">.*?><a [^>]*>([^<]+)<\/a><\/span>/);
                    const extractedAuthor = authorMatch ? authorMatch[1].trim() : "取得できませんでした";

                    // Discordに送信するメッセージを作成
                    const message = {
                        // content: `> **下書きが批評開始になりました！**\n> **タイトル:** ${item.title}\n> **著者:** ${extractedAuthor}\n> **リンク:** ${item.link}`
                        content: `${item.title} by ${extractedAuthor} > ${item.link}`
                    };

                    // WebhookへPOST送信
                    await fetch(DISCORD_WEBHOOK_URL, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify(message)
                    });

                    console.log(`通知を送信しました: ${item.title}`);
                }
            } else {
                console.log("新着記事はありませんでした");
            }

            const currentUrls = items.map(item => item.link);
            await env.HISTORY_KV.put("previous_urls", JSON.stringify(currentUrls));
            console.log("Success: Checked and updated RSS.");

        } catch (error) {
            console.error('エラーが発生しました:', error);
        }
    }
};