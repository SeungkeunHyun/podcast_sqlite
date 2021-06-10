class TIE {
    constructor() {
        this.className = "TIE";
        this.classFullName = "Take It Easy";
    }

    async init() {
        var self = this;
        console.log(this);
        var metaTags = await self.loadFile("templates/tpl_head.html");
        document.head.innerHTML += metaTags.responseText;
        console.log(metaTags);
        var json = await this.loadFile("json/libs.json");
        if (!json.response) {
            console.error("json was lot loaded with given url");
            throw new Exception("json was lot loaded with given url");
        }
        var libs = JSON.parse(json.response);
        await self.loadLibs(self, libs);
        console.log("loaded all libraries", jQuery);
    }


    async loadLibs(self, libs) {
        while (libs.length) {
            var lib = libs.shift();
            await self.addHeader(lib);
        }
    }

    addHeader(json) {
        return new Promise(resolve => {
            for (var k in json) {
                var elm = document.createElement(k);
                for (var a in json[k]) {
                    elm.setAttribute(a, json[k][a]);
                }
                if (k == "script") {
                    elm.setAttribute("charset", "UTF-8");
                }
                elm.onload = function (e) {
                    console.log(e);
                    resolve(e);
                }
                document.head.appendChild(elm);
                console.log(elm);
            }
        });
    }

    loadFile(src) {
        return new Promise(resolve => {
            var xobj = new XMLHttpRequest();
            //xobj.overrideMimeType("application/json");
            xobj.open('GET', src, true);
            xobj.onreadystatechange = function () {
                if (xobj.readyState == 4 && xobj.status == "200") {
                    resolve(xobj);
                }
            }
            xobj.send(null);
        });
    }

    loadExternalFile(src) {
        return new Promise(resolve => {
            var xobj = new XMLHttpRequest();
            //xobj.overrideMimeType("application/json");
			if(src.indexOf("podbbang") > -1) {
				xobj.open('GET', "http://skhyun.pe.hu/podcast/php/util/fetchURL.php?uri=" + src, true);
			} else {
				xobj.open('GET', "/php/util/fetchURL.php?uri=" + src, true);
			}
            xobj.onreadystatechange = function () {
                if (xobj.readyState == 4 && xobj.status == "200") {
                    resolve(xobj);
                }
            };
            xobj.send(null);
        });
    }
}