class CustomProvider {
    constructor({ libs, movieInfo, settings }) {
        this.libs = libs;
        this.movieInfo = movieInfo;
        this.settings = settings;
        this.state = {
            detailUrl: false,
            hosts: []
        };
        this.URL = {
            DOMAIN: 'https://example.com', // ضع رابط الموقع المستهدف هنا
            SEARCH: (title, type) => {
                const query = this.libs.stringHelper.convertToSearchQueryString(title, '+');
                return `https://example.com/search?q=${query}`;
            }
        };
    }

    async searchDetail() {
        const { httpRequest, cheerio, stringHelper } = this.libs;
        const { title, year, season, episode, type } = this.movieInfo;
        
        let detailUrl = false;
        
        // 1. إرسال طلب البحث للموقع
        const searchUrl = this.URL.SEARCH(title, type);
        const htmlSearch = await httpRequest.getHTML(searchUrl);
        
        const $ = cheerio.load(htmlSearch);
        
        // 2. تحليل صفحة النتائج ومطابقة العنوان والسنة
        const self = this;
        $('.search-result-item').each(function() {
            const itemTitle = $(this).find('.title').text().trim();
            const itemYear = parseInt($(this).find('.year').text().trim()) || 0;
            const href = $(this).find('a').attr('href');
            
            if (stringHelper.shallowCompare(title, itemTitle) && (year === 0 || year === itemYear)) {
                detailUrl = href.startsWith('http') ? href : self.URL.DOMAIN + href;
                return false; // كسر الحلقة عند العثور على النتيجة المطابقة
            }
        });

        this.state.detailUrl = detailUrl;
    }

    async getHostFromDetail() {
        const { httpRequest, cheerio } = this.libs;
        const hosts = [];
        const { detailUrl } = this.state;
        
        if (!detailUrl) {
            throw new Error("NOT_FOUND");
        }

        // 3. جلب صفحة العرض واستخراج روابط الحلقات أو السيرفرات المباشرة
        const htmlDetail = await httpRequest.getHTML(detailUrl);
        const $ = cheerio.load(htmlDetail);

        // مثال على استخراج رابط المشغل المضمن (Embed / Stream)
        const embedUrl = $('iframe.player-iframe').attr('src');
        if (embedUrl) {
            hosts.push({
                provider: {
                    url: detailUrl,
                    name: "CustomProvider"
                },
                result: {
                    file: embedUrl,
                    label: "HD",
                    type: "embed" // أو "direct" إذا كان رابط فيديو مباشر مثل m3u8 أو mp4
                }
            });
        }

        this.state.hosts = hosts;
    }
}

// التوقيع البرمجي الإلزامي الذي ينتظره محرك التطبيق LoadAddOns:
exports.default = async function(libs, movieInfo, settings) {
    const provider = new CustomProvider({ libs, movieInfo, settings });
    await provider.searchDetail();
    if (provider.state.detailUrl) {
        await provider.getHostFromDetail();
    }
    return provider.state.hosts;
};