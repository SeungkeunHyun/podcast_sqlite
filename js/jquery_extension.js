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
