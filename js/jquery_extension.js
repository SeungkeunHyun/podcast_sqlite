jQuery.download = function (url, data, tgt) {
	//url and data options required
	if (url && data) {
		//data can be string of parameters or array/object
		console.log(data);
		if (data.lnk.toLowerCase().indexOf(".mp3") == -1) {
			let $frame = $("#dlFrame");
			$frame.attr("src", "/php/util/downloadBinary.php?url=" + data.lnk);
			return;
		}
		var $frm = $("#frmDownload");
		if (!$frm.length) {
			$frm = jQuery(
				'<form id="frmDownload" accept-charset="UTF-8" action="' +
				url +
				'" target="' +
				tgt +
				'" method="post"></form>'
			);
			$frm.appendTo("body");
		}
		$frm.empty();
		var inputs = "";
		for (var k in data) {
			$frm.append(
				`<input type="hidden" name="${k}" value="${
				data[k] ? data[k].replace(/"/g, "'") : ""
				}" />\n`
			);
		}
		//send request
		console.log($frm[0]);
		$frm.submit();
	}
};

jQuery.copyToClipboard = function (text) {
	console.log(this, text);
	let dummy = document.createElement("textarea");
	let pnode = document.body;
	if($('div.modal.show').length) {
		pnode = $('div.modal.show')[0];
	} 
	pnode.appendChild(dummy);
	dummy.value = text;
	dummy.select();
	document.execCommand("copy");
	pnode.removeChild(dummy);
}

jQuery.getQueryParams = function (url) {
	var qparams = {},
		parts = (url || '').split('?'),
		qparts, qpart,
		i = 0;

	if (parts.length <= 1) {
		return qparams;
	} else {
		qparts = parts[1].split('&');
		for (i in qparts) {

			qpart = qparts[i].split('=');
			qparams[decodeURIComponent(qpart[0])] =
				decodeURIComponent(qpart[1] || '');
		}
	}
	return qparams;
};

if (typeof JSON.clone !== "function") {
	JSON.clone = function (obj) {
		return JSON.parse(JSON.stringify(obj));
	};
}