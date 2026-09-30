# Mobile social-selling order workflow research

Date checked: 2026-09-21

## Findings

| Channel | Official automated intake | Recommended intake |
| --- | --- | --- |
| Facebook Page Messenger | Messenger Platform/webhooks for a Facebook Page | Webhook creates an order draft for seller review |
| Personal Facebook/Messenger | No published official API for reading a personal inbox | Copy text or share a screenshot to Auto Fill |
| Zalo Official Account | OA OpenAPI and realtime webhooks; Zalo describes OpenAPI as an OA paid extension | Webhook creates an order draft for seller review |
| Personal Zalo | No published OA inbox API for personal accounts | Hold message, Forward, Other app, Auto Fill |

## Primary sources

- Meta's official Messenger Platform workspace requires a Facebook Page, Page access token and Page-scoped IDs: <https://www.postman.com/meta/messenger-platform-api/overview>
- Meta Messenger Platform API documentation: <https://www.postman.com/meta/messenger-platform-api/documentation/iyp204x/messenger-platform-api>
- Zalo OA OpenAPI overview: <https://oa.zalo.me/home/function/extension>
- Zalo OA extended features and OpenAPI: <https://oa.zalo.me/home/resources/library/tinh-nang-mo-rong-nang-cap-zalo-oa_2410156908111809541>
- Zalo developer documentation: <https://developers.zalo.me/docs>
- Zalo Help documents forwarding a message to another application: <https://help.zalo.me/huong-dan/chuyen-muc/zalo-cong-viec/gui-tin-nhan-cho-nhieu-nguoi-cung-luc-tren-zalo/>
- Android officially supports receiving `text/plain` and `image/*` from other apps through `ACTION_SEND`; receiving apps should let the user confirm and edit the content: <https://developer.android.com/develop/ui/compose/sharing/receive>
- Android Autofill services can inject user-selected datasets into views in other applications: <https://developer.android.com/identity/autofill/autofill-services>
- Google Play Accessibility automation policy requires declaration, prominent consent and narrow deterministic behaviour: <https://support.google.com/googleplay/android-developer/answer/10964491>

## Product recommendation

1. Personal Zalo: ship Share-to-Auto-Fill first.
2. Personal Messenger: support copy/clipboard and screenshot OCR; do not scrape the inbox.
3. Facebook Page and Zalo OA: offer webhook-based automatic draft creation as a paid tier.
4. On Android, use Autofill Service plus an order keyboard to transfer reviewed data into J&T/VNPost. Keep Accessibility automation optional for controlled enterprise distribution and stop before final submission.
5. Always require seller review of customer name, phone, address and COD before creating the carrier order.
