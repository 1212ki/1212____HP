function ticketReplyResult_(ok) {
  return ContentService.createTextOutput(JSON.stringify({ ok: ok }))
    .setMimeType(ContentService.MimeType.JSON);
}

function doPost(e) {
  try {
    var expected = PropertiesService.getScriptProperties()
      .getProperty("TICKET_AUTOREPLY_TOKEN");
    var type = String(e && e.postData && e.postData.type || "")
      .split(";")[0].trim().toLowerCase();
    if (!expected || type !== "application/x-www-form-urlencoded") {
      return ticketReplyResult_(false);
    }
    var p = e && e.parameter || {};
    var all = e && e.parameters || {};
    var keys = ["token", "receipt_id", "live", "name", "email", "quantity", "message"];
    for (var i = 0; i < keys.length; i += 1) {
      var key = keys[i];
      if (!Object.prototype.hasOwnProperty.call(p, key)
          || typeof p[key] !== "string"
          || !Array.isArray(all[key]) || all[key].length !== 1) {
        return ticketReplyResult_(false);
      }
    }
    if (p.token !== expected) return ticketReplyResult_(false);
    var receiptId = p.receipt_id.trim();
    var live = p.live.trim();
    var name = p.name.trim();
    var email = p.email.trim();
    var quantity = p.quantity.trim();
    var message = p.message.trim();
    if (!receiptId || !live || !name
        || /[\r\n]/.test(receiptId + live + name)
        || !/^[^\s@,;<>]+@[^\s@,;<>]+\.[^\s@,;<>]+$/.test(email)
        || !/^(?:[1-9]|10)$/.test(quantity)) {
      return ticketReplyResult_(false);
    }
    var body = [
      "ticket予約を受け付けました。",
      "",
      "受付ID: " + receiptId,
      "ライブ: " + live,
      "名前: " + name,
      "e-mail: " + email,
      "枚数: " + quantity,
      "備考: " + (message || "なし"),
      "",
      "当日はお気をつけてお越しください。"
    ].join("\n");
    GmailApp.sendEmail(email, "ticket予約の控え | 松本一樹", body, {
      name: "松本一樹 ticket",
      bcc: "1212ki.info@gmail.com"
    });
    return ticketReplyResult_(true);
  } catch (_error) {
    return ticketReplyResult_(false);
  }
}
