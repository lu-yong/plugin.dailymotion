
var http = require('showtime/http');
var channel_name_bak = '';

var channel_list = ['music', 'videogames', 'sport', 'news', 'shortfilms', 'tv', 'fun',
    'lifestyle', 'auto', 'animals', 'creation', 'people', 'tech', 'travel', 'kids'];

(function(plugin){  //插件入口

    var PLUGIN_PREFIX = "dailymotion:";
    var service = plugin.createService("dailymotion", PLUGIN_PREFIX + "start", "tv", true, "dailymotion.bmp");

    plugin.addURI(PLUGIN_PREFIX + "start", function(page){  //获取分组

        for(var i in channel_list)
        {
            var metadata = {
                title: channel_list[i]
            };
            page.appendItem(PLUGIN_PREFIX + 'channel_name:' + channel_list[i], 'directory', metadata);
        }
    });

//url = "https://api.dailymotion.com/channel/music/videos?fields=duration,id,owner.username,title,thumbnail_medium_url,views_total&sort=recent&family_filter=0&page=1&limit=4"
//{"page":1,"limit":1,"explicit":false,"total":8725281,"has_more":true,"list":[{"duration":90,"id":"x6bg27y","owner.username":"maciek970213","title":"stella no mahou ed","thumbnail_medium_url":"http:\/\/s2.dmcdn.net\/oi240\/160x120-jR-.jpg","views_total":0}]}

    plugin.addURI(PLUGIN_PREFIX + "channel_name:(.*)", function(page, channel_name){ //获取某个分组下的节目

        var total = 0;
        var num_get_onetime = 16;
        var page_num = 1;

        if(channel_name != channel_name_bak){
            total = 0;
            channel_name_bak = channel_name;
        }

        function loader() {
            page_num++;
            var url = "https://api.dailymotion.com/channel/" + channel_name
                    + "/videos?fields=duration,id,owner.username,title,thumbnail_medium_url,views_total&sort=recent&family_filter=0"
                    + "&page=" + page_num
                    + "&limit=" + num_get_onetime;

                var response_text = http.request(url, {
                    headers: {
                        "Host": "api.dailymotion.com",
                        "Accept": "*/*",
                        "Connection": "keep-alive",
                        "Cookie": "family_filter=off; ff=off",
                        "User-Agent": "Mozilla/5.0 (X11; Linux x86_64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/62.0.3202.94 Safari/537.36"
                    },
                }).toString();

            var response = JSON.parse(response_text);
            if(response.total == 0){
                return false;
            }

            var video_list = response.list;
            for(var i in video_list){
                var station_id = video_list[i].id;
                if(!station_id) continue;

                var video_info = {
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
                    title: video_list[i].title,
                    icon: video_list[i].thumbnail_medium_url,
                    extra_data: "total dynamic:" + total
                };
                page.appendItem(PLUGIN_PREFIX + "video_info:" + JSON.stringify(video_info), "directory", metadata);
            }

            return true;
        }

        loader();
        page.paginator = loader;
    });


    plugin.addURI(PLUGIN_PREFIX + "video_info:(.*)", function(page, video_info){  //多分辨节目

        var info = JSON.parse(video_info);

        var hour =  Math.floor(info.duration / 3600);
        var min =  Math.floor((info.duration % 3600) / 60);
        var sec = info.duration % 60;

        var duration_str = ((hour < 10)?("0"+ hour):(hour))
                         + ((min < 10)?(":0"+ min):(":"+ min))
                         + ((sec < 10)?(":0"+ sec):(":"+ sec));

        var url = "http://www.dailymotion.com/embed/video/" + info.video_id;
        //print("\n-----url: "+ url +"-----\n");
        var response_text = http.request(url, {
            headers: {
                "Host": "www.dailymotion.com",
                "Accept": "*/*",
                "Connection": "keep-alive",
                "Cookie": "family_filter=off; ff=off"
            },
        }).toString();
        var strArray = response_text.match(/\{"type":"video\\\/mp4"[^\}]+\}/g);

        for(var i in strArray){
            var play_url = JSON.parse(strArray[i]).url;
            var play_res = strArray[i].match(/\d+x\d+/i)[0];

            //print("play_res: " + play_res + "\t\tplay_url: " +play_url);

            var description_str = "Title: " + info.title
                                + "\nOwner: " + info.owner
                                + "\nResolution: " + play_res
                                + "\nDuration: " + duration_str
                                + "\nViewers: " + info.viewers;

            var metadata = {
                title: play_res,
                icon: info.icon_url,
                description: description_str
            };

            page.appendItem(PLUGIN_PREFIX + "play_url:" + play_url, "video", metadata);
        }
    });

    plugin.addURI(PLUGIN_PREFIX + "play_url:(.*)", function(page, play_url){  //播放链接

        var videoParams = {
            sources: [{
                url: play_url,
            }],
            no_subtitle_scan: true,
            subtitles: []
        }

        page.source = 'videoparams:' + JSON.stringify(videoParams);
    });

})(this);

