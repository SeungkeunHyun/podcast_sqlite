class QPHelper {
	static storeKey = 'qpBookmarks';
	static htmlCache = {};
	static columnsEpisode = [
		{
			"data": "title",
			"title": "title",
			"render": function (val, typ, row, meta) {
				return `<span style='cursor:pointer' title='${val}' >${val} <i class='fas fa-play'></i></span>`;
			}
		},
		{
			"data": "pubDate",
			"title": "published",
			"render": function (val, typ, row, meta) {
				const dat = moment(val);
				return `<span style='display:none'>${dat.valueOf()}</span><span title='${val}'>${moment(val).fromNow()}</span>`;
			}
		},
		{
			"data": "mediaURL",
			"title": "<i class='fas fa-download'></i>",
			"render": function (val, typ, row, meta) {
				return `<button class='btn' type='button' role='button' title='${val}'><i class='fas fa-download'></i></button>`;
			}
		}
	];
	static columnsBookmark = [
		{
			data: "cast",
			title: "cast",
			render: (v, t, r, m) => {
				return `<img src='${r.image}' width='40' alt='${r.cast}' class='rounded'>`;
			}
		},
		{
			data: "title",
			title: "title",
			render: (v, t, r, m) => {
				return `<h5 class='font-weight-bold'>${r.cast}</h5><p>${v}</p>`;
			}
		},
		{
			data: "currentTime",
			title: "current time",
			render: (v, t, r, m) => {
				return QPHelper.makeTimeInfo(v);
			}
		},
		{
			data: "recordedAt",
			title: "recorded at",
			render: (v, t, r, m) => {
				return moment(v).format('YYYY-MM-DD H:mm');
			}
		}
	];

	static columnsCast = [
		{
			"data": "provider",
			"title": "provider",
			"width": "5%"
		},
		{
			"data": "category",
			"title": "category",
			"width": "8%"
		},
		{
			"data": "name",
			"title": "title",
			"width": "50%",
			"render": function (val, typ, row, meta) {
				return `<div class='media'>
                            <div class='media-left'><img src='${row.imageURL}' class='media-object rounded' width='60px'></div>
							<div class='media-body p-3'><h5 class='media-heading'>${val} <span class='badge badge-info'>${row.episodes}</span></h5>
							<small title='${row.summary}'>${QPHelper.stringCut(row.summary, 80)}<br/><span class='text-right'>last update: ${row.lastPubAt.slice(0, -3)}</small>
							</div>
                            </div>`;
			}
		},
		{
			"data": "lastPubAt",
			"title": "last pub at",
			"width": "10%",
			"render": function (val, typ, row, meta) {
				const dat = moment(val);
				return `<span style='display:none'>${dat.valueOf()}</span>${moment(val).fromNow()}`;
			}
		},
		{
			"data": "episodes",
			"title": "episodes",
			"visible": false
		}
	];

	static async loadHTML(uriPage) {
		if (QPHelper.htmlCache.hasOwnProperty(uriPage)) {
			return this.htmlCache[uriPage];
		}
		const res = await fetch(uriPage);
		const chtml = await res.text();
		this.htmlCache[uriPage] = chtml;
		return chtml;
	}

	static listBookmarks(bmSelector, storeKey) {
		$(bmSelector).attr('data-content', '');
		if (localStorage.getItem(storeKey) != null) {
			const bms = JSON.parse(localStorage.getItem(storeKey));
			let $ul = $('ul');
			for (let k in bms) {
				let bmark = bms[k];
				$ul.append(`<li>
							<div class='media'>
								<img class="mr-3" src="${bmark.image}" width='60' alt="${bmark.cast}">
									<div class="media-body">
										<h5 class="mt-0">${bmark.cast}</h5>
										${bmark.title} (${QPHelper.makeTimeInfo(parseInt(bmark.currentTime))})
									</div>
							</div>
						</li>`);
			}
			return "<div id='divBM'>" + $ul[0].outerHTML + "</div>";
		} else {
			return "None of bookmarks";
		}
	}

	static makeTimeInfo(ti) {
		const dur = moment.duration(ti * 1000);
		return (dur.hours() == 0 ? '' : dur.hours() + ':') + (dur.minutes() == 0 ? '' : dur.minutes() + ':') + dur.seconds();
	}

	static stringCut(txt, len) {
		return txt.length > len ? txt.substring(0, len) + '..' : txt;
	}
}