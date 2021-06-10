class LocalStorageUtil {
    static getItemFromLocalStorage(skey, ikey, ival) {
        var regData = localStorage.getItem(skey);
        if (regData != null && regData.length > 0) {
            regData = $.parseJSON(regData);
            var found = regData.find(rec => rec[ikey] === ival);
            if (found.length) {
                return found[0];
            }
        }
        return null;
    }

    static getItemArrayFromLocalStorage(skey) {
        var regData = localStorage.getItem(skey);
        if (regData) {
            return $.parseJSON(regData);
        }
        return null;
    }

    static removeItemFromLocalStorage(skey, ikey, ival) {
        var regData = localStorage.getItem(skey);
        if (regData) {
            regData = $.parseJSON(regData);
            var newData = regData.filter(rec => rec[ikey] !== ival);
            localStorage.setItem(skey, JSON.stringify(newData, undefined, 2));
        }
    }

    static registerLocalStorage(skey, ikey, jsonDat) {
        var regDats = localStorage.getItem(skey);
        if (!regDats) {
            localStorage.setItem(skey, JSON.stringify([jsonDat], undefined, 2));
        } else {
            var regDats = $.parseJSON(regDats);
            var newDats = regDats.filter(rec => rec[ikey] !== jsonDat[ikey]);
            newDats.push(jsonDat);
            newDats.sort(function (a, b) {
                return b.stoppedAt - a.stoppedAt;
            });
            //console.log(regDats, jsonDat);
            localStorage.setItem(skey, JSON.stringify(newDats, undefined, 2));
        }
    }
}