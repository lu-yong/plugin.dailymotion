
/**
 * page 是一个全局变量，表示页面，是固定写法
 * page.appendItem(entry_str, mark_str, object)
 * appendItem 第1个参数是入口标记，是一个字符串，写法: PLUGIN_PREFIX + 'key:' + value
 * key 一般可以自定义，只要与 addURI 对应即可
 * value 值会传递给 addURI 的函数，如果该对象不是字符串，需要使用 JSON.stringify(obj) 转换为字符串，再在 addURI 中使用 JSON.parse(value) 转换回来即可
 * 注意 search 特殊，没有写value，她的 value 通过键盘获得
 * appendItem 第2个参数是类型标记, 'search' 搜索; 'directory' 目录(OK刷新右边的视频页显示); 'video' 播放(OK进入播放，无'music')
 * appendItem 第3个参数是类型属性对象，不同对象有固定的成员
 * plugin.addURI(entry_str, function(page, key)
 * addURI 第1个参数是入口标记，是一个字符串，和 appendItem 对应，写法: PLUGIN_PREFIX + 'key:(.*)'
 * addURI 第2个参数是函数对象，函数的第1个参数是固定 page; 第2个参数的值对应 appendItem 的 value
 **/

var http = require('showtime/http');
var channel_name_bak = '';

var PLUGIN_PREFIX = "dailymotion:";
var channel_list = ['music', 'videogames', 'sport', 'news', 'shortfilms', 'tv', 'fun',
    'lifestyle', 'auto', 'animals', 'creation', 'people', 'tech', 'travel', 'kids'];

(function(plugin){  //插件入口

    // 创建任务，start固定标记开始，tv视频(music是广播), true固定写法，xxxx.bmp是插件图标名字
    var service = plugin.createService("dailymotion", PLUGIN_PREFIX + "start", "tv", true, "dailymotion.bmp");

    /******** 视频组 ********/
    plugin.addURI(PLUGIN_PREFIX + "start", function(page){  //获取分组，承接了 plugin.createService 的 start

        page.appendItem(PLUGIN_PREFIX + "search:", 'search', {title: 'Search'}); // 添加搜索栏

        for(var i in channel_list)
        {
            var metadata = {
                title: channel_list[i]  // title:xxxx 分类的字符串
            };
            page.appendItem(PLUGIN_PREFIX + 'channel_name:' + channel_list[i], 'directory', metadata); // 添加其他分组
        }
    });


    /******** 分组下的视频列表 ********/
    plugin.addURI(PLUGIN_PREFIX + "search:(.*)", function(page, search) { // 搜索组
        dailymotion_refresh_page(page, search, "search");
    });


    plugin.addURI(PLUGIN_PREFIX + "channel_name:(.*)", function(page, channel_name){ //其它分组
        dailymotion_refresh_page(page, channel_name, "group");
    });

    /******** 视频下的子列表 ********/
    plugin.addURI(PLUGIN_PREFIX + "video_info:(.*)", function(page, video_info){  //多分辨节目

        var info = JSON.parse(video_info);

        var hour =  Math.floor(info.duration / 3600);
        var min =  Math.floor((info.duration % 3600) / 60);
        var sec = info.duration % 60;

        var duration_str = ((hour < 10)?("0"+ hour):(hour))
                         + ((min < 10)?(":0"+ min):(":"+ min))
                         + ((sec < 10)?(":0"+ sec):(":"+ sec));

        var url = "https://www.dailymotion.com/embed/video/" + info.video_id;
        //print("\n-----url: "+ url +"-----\n");
        var response_text = http.request(url, {
            headers: {
                "Host": "www.dailymotion.com",
                "Accept": "*/*",
                "Connection": "keep-alive",
                "Cookie": "family_filter=off; ff=off"
            },
        }).toString();

        var re = /__PLAYER_CONFIG__ =([\s\S]*?);\<\/script\>/g;
        var match = re.exec(response_text);
        var metadata_info = JSON.parse(match[1].toString()).metadata;

        url = metadata_info.qualities.auto[0].url;
        //print("\n-----url: "+ url +"-----\n");
        response_text = http.request(url, {
            headers: {
                "Host": "www.dailymotion.com",
                "Accept": "*/*",
                "Connection": "keep-alive",
                "Cookie": "family_filter=off; ff=off"
            },
        }).toString();

        var temp_urllist = response_text.match(/\nhttps[\s\S]*?(?=#cell)/g);
        var temp_reslist = response_text.match(/NAME="[\s\S]*?(?=",)/g);
        var description_str = "Title: " + info.title
            + "\nOwner: " + info.owner
            + "\nDuration: " + duration_str
            + "\nViewers: " + info.viewers;

        var urllist = new Array();
        var reslist = new Array();
        urllist[0] = temp_urllist[0];
        reslist[0] = temp_reslist[0];

        for(i = 0; i < temp_reslist.length; i++)
        {
            var same_find = 0;

            for(j = 0; j < reslist.length; j++)
            {
                if(temp_reslist[i] == reslist[j])
                {
                    same_find = 1;
                    break;
                }
            }

            if(0 == same_find)
            {
                urllist.push(temp_urllist[i]);
                reslist.push(temp_reslist[i]);
            }
        }

        for(var i in urllist)
        {
            var metadata = {
                title: reslist[i].replace("NAME=\"", ""),
                icon: info.icon_url,
                description: description_str  // description: xxxx 左侧的视频说明
            };
            page.appendItem(PLUGIN_PREFIX + "play_url:" + urllist[i].replace("\n", ""), "video", metadata);
        }
    });

    /******** 播放链接 ********/
    plugin.addURI(PLUGIN_PREFIX + "play_url:(.*)", function(page, play_url){  //播放链接

        var videoParams = {
            sources: [{
                url: play_url,
            }],
            no_subtitle_scan: true,
            subtitles: []
        }

        page.source = 'videoparams:' + JSON.stringify(videoParams); // 真正的播放链接
    });

})(this);

/******** 定义刷新页面的函数 ********/
// search_url = "https://api.dailymotion.com/videos?fields=duration,id,owner.username,title,thumbnail_medium_url,views_total&sort=relevance&family_filter=0&search=hero&page=1&limit=8"
// group_url = "https://api.dailymotion.com/channel/music/videos?fields=duration,id,owner.username,title,thumbnail_medium_url,views_total&sort=recent&family_filter=0&page=1&limit=4"
// return_value = {"page":1,"limit":1,"explicit":false,"total":8725281,"has_more":true,"list":[{"duration":90,"id":"x6bg27y","owner.username":"maciek970213","title":"stella no mahou ed","thumbnail_medium_url":"http:\/\/s2.dmcdn.net\/oi240\/160x120-jR-.jpg","views_total":0}]}

function dailymotion_refresh_page(page, channel_name, style_name)
{
    var total = 0;
    var page_num = 0;
    var num_get_onetime = 16;

    if (channel_name != channel_name_bak) {
        total = 0;
        channel_name_bak = channel_name;
    }

    function loader() {
        page_num++;
        var url = "";
        if(style_name === "search") {
            url = "https://api.dailymotion.com"
                + "/videos?fields=duration,id,owner.username,title,thumbnail_medium_url,views_total&sort=relevance&family_filter=0"
                + "&search=" + channel_name
                + "&page=" + page_num
                + "&limit=" + num_get_onetime;
        } else {
            url = "https://api.dailymotion.com"
                + "/channel/" + channel_name
                + "/videos?fields=duration,id,owner.username,title,thumbnail_medium_url,views_total&sort=recent&family_filter=0"
                + "&page=" + page_num
                + "&limit=" + num_get_onetime;
        }

        // http.request()下载网页，具体查看 http.js 文件
        // 可以使用 postman 软件查看url的返回
        var response_text = http.request(url, {
            headers: { // 有些请求必须要有正确的UA
                "Host": "api.dailymotion.com",
                "Accept": "*/*",
                "Connection": "keep-alive",
                "Cookie": "family_filter=off; ff=off",
                "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36"
            },
        }).toString();

        var response = JSON.parse(response_text); //对象字符串转换为对象
        if (response.total == 0) {
            return false;
        }

        var video_list = response.list;
        for (var i in video_list) {
            var station_id = video_list[i].id;
            if (!station_id)
                continue;
            if (total >= response.total) { // 防止超出总数
                return false;
            }

            var video_info = {  // 传递给 addURI 的对象
                video_id: video_list[i].id,
                title: video_list[i].title,
                icon_url: video_list[i].thumbnail_medium_url,
                owner: video_list[i]['owner.username'],
                viewers: video_list[i].views_total,
                duration: video_list[i].duration
            };

            //print("id: " + video_list[i].id + "\ttitle: " + video_list[i].title + "\ticon_url: " + video_list[i].thumbnail_medium_url);
            total++;
            var metadata = {
                title: video_list[i].title,                 // title: xxxx 视频名称
                icon: video_list[i].thumbnail_medium_url,   // icon: xxxx 视频图标
                extra_data: "total dynamic:" + total        // extra_data: xxxx 右上角的字符串(一般是视频总数)
            };
            page.appendItem(PLUGIN_PREFIX + "video_info:" + JSON.stringify(video_info), "directory", metadata); // 视频下还有子页
        }

        return true;
    }

    loader(); // 固定写法
    page.paginator = loader; // 固定写法
}

