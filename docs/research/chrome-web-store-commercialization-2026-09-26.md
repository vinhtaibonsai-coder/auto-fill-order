# Nghiên cứu phát hành và thương mại hoá Auto Fill Order trên Chrome Web Store

**Ngày kiểm tra:** 26/09/2026  
**Phạm vi:** yêu cầu tài khoản nhà phát triển, quy trình phát hành Manifest V3, quyền riêng tư và dữ liệu, single purpose/quyền truy cập/remote code, tài sản listing, review/testing, thanh toán và checklist go-to-market cho browser-extension SaaS tại Việt Nam.

Tài liệu chỉ dựa trên nguồn chính thức của Google/Chrome và cơ quan nhà nước Việt Nam. Các đề xuất chiến lược được ghi rõ là **khuyến nghị**, không phải yêu cầu nguyên văn của Google và không thay thế tư vấn pháp lý/kế toán.

## Kết luận điều hành

Auto Fill Order có thể thương mại hoá theo mô hình **extension miễn phí để cài đặt + dịch vụ SaaS trả phí bên ngoài Chrome Web Store**, nhưng trước khi public cần đóng bốn cổng:

1. **Policy:** một mục đích duy nhất, quyền/host tối thiểu, toàn bộ mã thực thi được đóng gói, không chạy remote code.
2. **Privacy:** công bố đúng luồng dữ liệu đơn hàng, người nhận, mục đích, thời gian lưu; xin đồng ý trong sản phẩm trước khi gửi dữ liệu lên cloud/AI; cho phép rút lại đồng ý và xoá dữ liệu.
3. **Reviewability:** reviewer có tài khoản thử, dữ liệu mẫu, luồng thao tác và kết quả mong đợi; bản ZIP production tự chứa và dễ đọc.
4. **Commerce:** checkout, entitlement, hoá đơn/thuế, hoàn tiền và hỗ trợ do nhà phát triển tự vận hành; listing phải nói rõ phần nào cần trả phí.

Rủi ro bị từ chối cao nhất đối với loại sản phẩm này là quyền quá rộng, mô tả “offline/local” không khớp lưu lượng cloud/AI, remote configuration vô tình trở thành remote logic, thiếu consent trước khi gửi PII, và reviewer không thể đi hết luồng vì cần tài khoản shop/carrier.

## 1. Tài khoản nhà phát triển và phí

| Yêu cầu hiện hành | Hành động đề xuất |
| --- | --- |
| Phải có tài khoản Google hợp lệ, chấp nhận Developer Agreement và trả **phí đăng ký một lần** trước khi publish. Bài đăng chính thức ngày 28/04/2026 ghi mức **“$5 registration fee”**; trang đăng ký/Agreement không nêu mã tiền tệ và vẫn cho Google quyền xác định mức phí, vì vậy cần xác nhận số tiền/loại tiền thực tế trong checkout. ([Register developer account](https://developer.chrome.com/docs/webstore/register), [Developer Agreement §2.1](https://developer.chrome.com/docs/webstore/program-policies/terms), [Chrome Developers — publisher roles, 28/04/2026](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard)) | Dùng tài khoản Google do doanh nghiệp kiểm soát; dự trù mức Google đang công bố là `$5`, mở dashboard để xác nhận số tiền thực trả và lưu hoá đơn. |
| Email tạo developer account không thể đổi; muốn đổi phải tạo tài khoản mới và chuyển item. ([Register developer account](https://developer.chrome.com/docs/webstore/register)) | Không dùng email cá nhân/ngắn hạn; dùng mailbox công ty được giám sát và có phương án khôi phục. |
| Publisher name và email liên hệ đã xác minh là bắt buộc. Địa chỉ vật lý bắt buộc nếu item có mua hàng, tính năng trả phí hoặc subscription. ([Set up developer account](https://developer.chrome.com/docs/webstore/set-up-account)) | Hoàn thiện hồ sơ pháp nhân, email hỗ trợ, địa chỉ có thể công khai trước khi bật gói trả phí. |
| 2-Step Verification là bắt buộc trước khi publish hoặc cập nhật extension. ([Program Policies — 2-Step Verification](https://developer.chrome.com/docs/webstore/program-policies/policies)) | Bật 2SV cho owner và các tài khoản có quyền xuất bản; lưu recovery code theo quy trình nội bộ. |
| Publisher mới ban đầu chỉ được publish tối đa hai extension; có thể yêu cầu tăng hạn mức. ([Publish](https://developer.chrome.com/docs/webstore/publish)) | Không tạo nhiều listing gần trùng nhau theo carrier/gói giá; tập trung một sản phẩm có một mục đích rõ. |
| Tất cả publisher phải khai Trader/Non-Trader. Nếu là Trader, Google yêu cầu legal name, số điện thoại và địa chỉ; thông tin xác minh được công khai trên listing. ([Trader FAQ](https://developer.chrome.com/docs/webstore/program-policies/trader-verification-faq), [Trader disclosure](https://developer.chrome.com/docs/webstore/program-policies/trader-disclosure)) | Với SaaS thu phí, chuẩn bị hồ sơ pháp nhân và số điện thoại hỗ trợ có thể công khai; tự đánh giá tư cách Trader với tư vấn pháp lý. |

Từ 28/04/2026, publisher có thể mời thành viên theo bốn vai trò Viewer, Item manager, Editor và Admin; người được mời không phải qua lại toàn bộ luồng đăng ký và không mất thêm phí. Đây là phương án nên dùng cho QA/operations thay vì chia sẻ tài khoản owner. ([Chrome Developers — expanded publisher roles](https://developer.chrome.com/blog/cws-role-expansion-developer-dashboard))

## 2. Quy trình publish Manifest V3

Manifest V2 đã bị vô hiệu hoá cho người dùng Chrome từ năm 2025 và các item MV2 còn lại đã bị gỡ khỏi Chrome Web Store ngày 31/08/2026. Bản nộp mới thực tế phải là Manifest V3. ([Manifest V2 support timeline](https://developer.chrome.com/docs/extensions/develop/migrate/mv2-deprecation-timeline))

Quy trình đề xuất:

1. Đăng ký/hoàn thiện publisher account, bật 2SV và xác minh email.
2. Test đúng bản production bằng “Load unpacked”. Kiểm tra `name`, `version`, `icons`, `description`; mô tả manifest tối đa 132 ký tự và mỗi lần upload phải tăng version. ([Prepare your extension](https://developer.chrome.com/docs/webstore/prepare))
3. ZIP **nội dung** thư mục extension, để `manifest.json` ở gốc archive. Giới hạn package là 2 GB. ([Prepare your extension](https://developer.chrome.com/docs/webstore/prepare), [Publish](https://developer.chrome.com/docs/webstore/publish))
4. Upload ZIP tại Developer Dashboard; hoàn thành Store Listing, Privacy, Distribution và Test Instructions nếu cần tài khoản/quyền truy cập đặc biệt. ([Publish](https://developer.chrome.com/docs/webstore/publish))
5. Chọn phạm vi Public/Unlisted/Private và quốc gia phân phối. Mọi phạm vi đều qua cùng chuẩn policy/review. Private phù hợp pilot với trusted testers. ([Distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution))
6. Submit for review, ưu tiên **deferred publishing** để kiểm soát thời điểm launch. Sau khi được duyệt, bản staged phải được publish trong 30 ngày, nếu không sẽ trở lại draft. ([Publish](https://developer.chrome.com/docs/webstore/publish))

## 3. Privacy và data-use disclosures

### Nghĩa vụ Chrome Web Store

- “Handle user data” bao gồm thu thập, truyền, sử dụng hoặc chia sẻ; dữ liệu chỉ xử lý/lưu local vẫn phải khai báo. Tên, số điện thoại, địa chỉ, mã tài khoản, form data, website content, authentication information và nội dung do người dùng tạo đều nằm trong các nhóm dữ liệu Google nêu. ([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq))
- Nếu xử lý user data, phải có privacy policy chính xác, cập nhật và gắn URL trong Dashboard; policy và disclosure trong sản phẩm phải nói rõ cách thu thập, sử dụng, chia sẻ và **mọi bên nhận dữ liệu**. ([Program Policies — Privacy Policy](https://developer.chrome.com/docs/webstore/program-policies/policies), [Privacy tab](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy))
- Privacy tab phải khai single purpose, giải trình từng permission, remote-code status, nhóm dữ liệu thu thập và chứng nhận Limited Use. Các khai báo phải khớp privacy policy và hành vi thực tế. ([Privacy tab](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy))
- Khi việc thu thập/chia sẻ không hiển nhiên, phải có disclosure nổi bật và thao tác đồng ý chủ động **trong UI sản phẩm trước khi xử lý**; chỉ đặt nội dung trong privacy policy, Terms hoặc listing là chưa đủ. ([User Data FAQ — prominent disclosure](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [Disclosure Requirements](https://developer.chrome.com/docs/webstore/program-policies/disclosure-requirements))
- Dữ liệu chỉ được dùng cho single purpose đã công bố và các mục đích vận hành liên quan. Không được bán/chuyển cho data broker, quảng cáo cá nhân hoá hay chấm điểm tín dụng; con người không được đọc dữ liệu trừ các ngoại lệ hạn chế của policy. ([Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use))
- Dữ liệu phải được truyền bằng kết nối an toàn; FAQ nêu HTTPS/WSS cho truyền tải và khuyến nghị mã hoá mạnh khi lưu. Authentication/payment information không được công khai. ([User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq), [Program Policies — Handling Requirements](https://developer.chrome.com/docs/webstore/program-policies/policies))

### Ma trận khai báo khuyến nghị cho Auto Fill Order

Đây là danh sách cần đối chiếu với network log và backend trước khi điền Dashboard, không phải kết luận rằng mọi trường đều đang được thu thập:

| Nhóm dữ liệu cần kiểm tra | Ví dụ | Disclosure/kiểm soát cần có |
| --- | --- | --- |
| Personally identifiable information | Tên người nhận, điện thoại, địa chỉ | Mục đích điền vận đơn; nơi xử lý; retention; delete/export; bên nhận. |
| Form/order content | Văn bản đơn thô, mã đơn, COD, ghi chú, nội dung form carrier | Nêu rõ local parsing và trường hợp gửi cloud/AI; không dùng cho quảng cáo/huấn luyện nếu không có căn cứ và bằng chứng hợp đồng. |
| Authentication information | Session/token, shop/user/device ID | Không đưa vào log hoặc listing; mã hoá; vòng đời ngắn; revoke; không gửi AI nếu không cần. |
| Website content/activity | Domain/route carrier, dữ liệu đọc/ghi trong form | Chỉ thao tác tại site/route hỗ trợ, theo hành động người dùng; không theo dõi lịch sử duyệt web chung. |
| Diagnostics/analytics | Lỗi selector, latency, phiên bản, thiết bị | Tách khỏi nội dung đơn; redaction PII; opt-out nếu phù hợp; retention ngắn. |

**Mẫu single purpose nên dùng:**

> Auto Fill Order chuyển nội dung đơn hàng do người dùng cung cấp thành các trường người nhận và vận chuyển để người dùng kiểm tra, sau đó điền các trường đó vào biểu mẫu của các hãng vận chuyển được hỗ trợ.

Không đưa CRM tổng quát, quảng cáo, ví điện tử hoặc nhiều công cụ không liên quan vào extension. Dashboard quản trị, billing và báo cáo đội nhóm nên nằm ở web app, còn extension chỉ là client cho luồng parse → review → fill.

## 4. Minimum permissions và remote code

- Google yêu cầu permission hẹp nhất đủ cho chức năng hiện có; không được xin trước quyền cho tính năng tương lai. Permission quá rộng có thể bị từ chối và `tabs`, broad host permissions hoặc sensitive execution permissions làm review lâu hơn. ([Program Policies — Use of Permissions](https://developer.chrome.com/docs/webstore/program-policies/policies), [Privacy tab](https://developer.chrome.com/docs/webstore/cws-dashboard-privacy), [Review process](https://developer.chrome.com/docs/webstore/review-process))
- Mỗi permission và host cần một lý do cụ thể trong Privacy tab. Với mỗi quyền, ghi “tính năng nào, thao tác nào, dữ liệu nào”; nếu có thể dùng quyền hẹp hơn/optional permission thì phải ưu tiên phương án đó.
- Manifest V3 yêu cầu toàn bộ logic vận hành có thể nhận biết từ code đã nộp. Remote `<script>`, `eval()` chuỗi tải về, JavaScript/WASM từ CDN hoặc interpreter chạy command từ server đều bị cấm. ([MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements), [Remote hosted code guidance](https://developer.chrome.com/docs/extensions/develop/migrate/remote-hosted-code))
- Gọi API server, đồng bộ tài khoản, xử lý dữ liệu phía server và tải JSON/config không chứa logic vẫn được phép. Remote config chỉ an toàn khi mọi nhánh xử lý đã nằm trong package; không biến JSON thành script, biểu thức, action program hoặc chuỗi lệnh phức tạp. ([MV3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements))

**Release gate:** scan bản bundle cuối cùng (không chỉ source) cho remote import/script/eval; pin host API sản xuất; loại quyền không có use case và test riêng từng permission warning.

## 5. Listing assets và metadata

| Asset/metadata | Yêu cầu chính thức |
| --- | --- |
| Extension icon | PNG 128×128 nằm trong ZIP; hướng dẫn khuyến nghị artwork vuông 96×96 với padding trong suốt. |
| Small promo tile | 440×280, bắt buộc. |
| Screenshot | Tối thiểu 1, tối đa 5; 1280×800 hoặc 640×400; phải thể hiện trải nghiệm thực. |
| Marquee | 1400×560, tuỳ chọn; cần nếu muốn có cơ hội được feature ở vị trí marquee. |
| Listing text | Mô tả chi tiết, category, language; chính xác, cập nhật, không keyword spam hoặc hứa tính năng không có. |
| URLs | Homepage và support URL nên trỏ tới domain chính thức; privacy-policy URL bắt buộc nếu xử lý user data. |

Nguồn: [Supplying Images](https://developer.chrome.com/docs/webstore/images), [Store Listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing), [Listing Requirements](https://developer.chrome.com/docs/webstore/program-policies/policies).

Có điểm không nhất quán trong tài liệu Google: trang Store Listing cũ liệt kê promotional video cùng nhóm tài sản phải cung cấp, trong khi trang Images nói chỉ icon, small promo và screenshot là bắt buộc. Hãy coi field thực tế trong Developer Dashboard là nguồn quyết định và chuẩn bị sẵn một video demo ngắn để không bị chặn.

Với Auto Fill Order, bộ ảnh nên gồm: dán đơn → kết quả parse/review → xác nhận điền form → kết quả trên portal carrier → màn hình consent/settings. Dùng ngôn ngữ “tương thích với/hỗ trợ VNPost, J&T…”; không dùng logo hoặc câu chữ khiến người dùng hiểu rằng sản phẩm được hãng vận chuyển bảo trợ nếu chưa có quyền.

## 6. Review và testing

- Review thường hoàn thành trong vài ngày nhưng có thể kéo dài vài tuần. Nếu quá ba tuần, Google hướng dẫn liên hệ developer support. New developer/new item, quyền nguy hiểm, host rộng, thay đổi code lớn hoặc code khó đọc làm review kỹ và lâu hơn. ([Review process](https://developer.chrome.com/docs/webstore/review-process))
- Từ 20/08/2026, Developer Dashboard chạy kiểm tra khả năng cài đặt tự động ngay khi upload package vào draft, trước khi submit; phải xử lý mọi lỗi install/validity ở bước này. ([Chrome Web Store review updates 2026](https://developer.chrome.com/blog/cws-review-updates-2026))
- Mọi submission mới/cập nhật và mọi visibility đều qua review; item đã publish còn có thể được review định kỳ. ([Review process](https://developer.chrome.com/docs/webstore/review-process), [Distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution))
- Test Instructions không bắt buộc cho mọi item, nhưng đặc biệt hữu ích nếu chức năng đầy đủ cần credential hạn chế hoặc tài khoản trả phí. ([Test Instructions](https://developer.chrome.com/docs/webstore/cws-dashboard-test-instructions))

**Gói reviewer nên chuẩn bị:**

1. Một tài khoản extension test riêng, không hết hạn trong thời gian review, đã có quota/entitlement cần thiết.
2. Nếu carrier login là bắt buộc, cung cấp sandbox/test credential hợp lệ hoặc một demo page tái hiện form mà reviewer có thể dùng an toàn.
3. Một đoạn đơn hàng mẫu không chứa PII thật, các bước bấm chính xác và expected result cho local parse, AI fallback, review và fill.
4. Chỉ dẫn thử consent/withdrawal, logout/revoke, offline fallback, lỗi quota/API và delete/export.
5. Video ngắn dự phòng và contact phản hồi nhanh nếu reviewer không vào được luồng.

## 7. Thanh toán và mô hình monetization

Chrome Web Store cho phép item miễn phí hoặc thu phí bằng hệ thống thanh toán do nhà phát triển chọn. Tuy nhiên Google không chịu trách nhiệm xử lý giao dịch, xác thực người đã trả tiền, lưu hồ sơ hay kê khai/nộp thuế; các phần đó thuộc nhà phát triển. ([What is the Chrome Web Store?](https://developer.chrome.com/docs/webstore/about), [Developer Agreement §3](https://developer.chrome.com/docs/webstore/program-policies/terms))

Nếu chức năng cơ bản cần trả tiền, điều đó phải được nói rõ trước khi cài. Giá/dịch vụ, điều khoản bán hàng, hoàn tiền/return policy và danh tính người bán phải rõ; dữ liệu thẻ phải được xử lý theo luật và tiêu chuẩn ngành thẻ. ([Accepting Payment From Users](https://developer.chrome.com/docs/webstore/program-policies/accepting-payment))

Developer Agreement cho phép free trial có upsell và extension làm điểm truy cập vào paid service, nhưng cảnh báo không thu khoản phí tương lai cho bản sao sản phẩm đã được cung cấp là “free”. Vì vậy cần mô tả chính xác là **gói miễn phí có giới hạn** hoặc **trial**, không quảng cáo toàn bộ sản phẩm là miễn phí rồi bất ngờ khoá sau này. ([Developer Agreement §3.3 và §4.4.3](https://developer.chrome.com/docs/webstore/program-policies/terms))

### Khuyến nghị mô hình sản phẩm

- **Free:** local parse, review thủ công, quota nhỏ, một người dùng/một shop. Mục tiêu là chứng minh giá trị trước khi xin PII/cloud consent.
- **Pro:** AI chuẩn hoá địa chỉ theo yêu cầu, cloud sync, quota cao hơn, template carrier, lịch sử và export.
- **Team:** nhiều nhân viên, role/approval, audit log, shared mappings, quản lý thiết bị, SLA/support ưu tiên.

Checkout nên mở trên website HTTPS; webhook cập nhật entitlement ở backend; extension chỉ đọc trạng thái gói từ server và không giữ secret thanh toán. Thiết kế grace period, retry, billing portal, huỷ gia hạn và khôi phục quyền lợi khi cài lại. Theo Developer Agreement, paid product/in-app transaction phải có kênh hỗ trợ hợp lệ; nhà phát triển cam kết phản hồi support trong ba ngày làm việc và vấn đề khẩn do Google chuyển trong 24 giờ. ([Developer Agreement §3.4](https://developer.chrome.com/docs/webstore/program-policies/terms))

## 8. Checklist go-to-market tại Việt Nam

### Gate A — pháp nhân, dữ liệu và bán hàng

- [ ] Xác định chủ thể bán hàng, tài khoản ngân hàng, hoá đơn/thuế, điều khoản subscription, huỷ gia hạn và hoàn tiền với tư vấn pháp lý/kế toán tại Việt Nam.
- [ ] Rà soát theo **Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15** (hiệu lực 01/01/2026) và **Nghị định 356/2025/NĐ-CP** (hiệu lực 01/01/2026). Luật xác lập các quyền được biết, đồng ý/rút lại, truy cập, chỉnh sửa, yêu cầu xoá/hạn chế; xử lý xuyên biên giới có rủi ro chế tài cao. ([Luật 91/2025/QH15](https://vanban.chinhphu.vn/?docid=214590&pageid=27160&typegroupid=3), [Nghị định 356/2025/NĐ-CP](https://vanban.chinhphu.vn/?docid=216387&pageid=27160&typegroupid=4), [Bộ Công an — quyền chủ thể dữ liệu và chế tài](https://mps.gov.vn/bai-viet/luat-bao-ve-du-lieu-ca-nhan-chinh-thuc-co-hieu-luc-thi-hanh-tu-ngay-01-01-2026-1767186124))
- [ ] Lập data inventory và hồ sơ đánh giá phù hợp cho Supabase/AI/logging; xác nhận vị trí lưu trữ, subprocessors, chuyển dữ liệu xuyên biên giới, thời hạn lưu và quy trình sự cố. Cổng Thông tin Chính phủ mô tả cơ chế hậu kiểm thông qua hồ sơ đánh giá tác động chuyển dữ liệu cá nhân xuyên biên giới. ([Cổng TTĐT Chính phủ](https://baochinhphu.vn/quoc-hoi-thong-qua-luat-bao-ve-du-lieu-ca-nhan-102250626151253737.htm))
- [ ] Rà soát website checkout dưới **Luật Thương mại điện tử 122/2025/QH15**, có hiệu lực 01/07/2026; xác định thủ tục thông báo/đăng ký áp dụng trên cổng chính thức trước khi nhận đặt hàng trực tuyến. ([Luật 122/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=216503&pageid=27160&typegroupid=3), [Online.gov.vn](https://online.gov.vn/), [quy trình thông báo website TMĐT bán hàng](https://online.gov.vn/Huong-Dan/QUY-TRINH-THONG-BAO-WEBSITE-TMDT-BAN-HANG-yJkpX0Qpjc))
- [ ] Đối chiếu Terms/pricing/support với **Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15**, đặc biệt trách nhiệm cung cấp thông tin trong giao dịch từ xa và trên không gian mạng. ([Luật 19/2023/QH15](https://vanban.chinhphu.vn/?classid=1&docid=208363&orggroupid=1&pageid=27160&previousPage=other+articles), [Bộ Công Thương — điểm mới của Luật](https://moit.gov.vn/tin-tuc/bao-chi-voi-nguoi-dan/mot-so-quy-dinh-moi-tai-luat-bao-ve-quyen-loi-nguoi-tieu-dung-nam-2023.html))

### Gate B — sản phẩm và compliance Chrome

- [ ] Chốt một single purpose và loại mọi tính năng không phục vụ parse → review → fill khỏi extension.
- [ ] Vẽ data-flow thực tế từ panel → service worker → backend → AI/subprocessor → storage/log; đối chiếu bằng network log.
- [ ] Thu hẹp permissions/hosts, giải trình từng quyền và chuyển quyền ít dùng sang optional nếu khả thi.
- [ ] Consent riêng cho cloud/AI trước lần gửi đầu tiên; cho phép tắt AI, rút consent và tiếp tục local mode.
- [ ] Bundle toàn bộ JS/WASM; scan production bundle để chặn remote hosted code, `eval` và command/config có thể thực thi.
- [ ] Công khai privacy policy, Terms, processor list, retention, export/delete và support contact trên domain chính thức.

### Gate C — hồ sơ CWS và pilot

- [ ] Publisher account công ty, 2SV, verified email, physical address và Trader declaration.
- [ ] Icon 128×128 PNG, tile 440×280, 3–5 screenshot 1280×800, video demo dự phòng, mô tả tiếng Việt rõ local/cloud/AI/paid features.
- [ ] Build production; ZIP với manifest ở gốc; kiểm tra version, file thừa, secret, source map và remote URL.
- [ ] Pilot 5–10 shop qua Private/trusted testers; lưu ý Private vẫn qua cùng policy review.
- [ ] Chuẩn bị reviewer account, sample order, test instructions, expected output và support response owner.
- [ ] Submit bằng deferred publishing; chừa lịch 2–4 tuần cho review/rework, không hứa ngày launch cứng với khách hàng.

### Gate D — launch và vận hành SaaS

- [ ] Launch ban đầu chỉ tại Việt Nam nếu đó là thị trường thực; mở thêm quốc gia sau khi privacy, thuế, consumer và Trader requirements đã được rà soát.
- [ ] External checkout + webhook entitlement + billing portal + invoice/tax flow; listing nói rõ free quota/trial và phần trả phí.
- [ ] Theo dõi activation, tỷ lệ parse thành công, tỷ lệ phải sửa tay, lỗi autofill theo carrier, crash/error rate, thời gian tiết kiệm, trial-to-paid, churn và ticket/100 người dùng.
- [ ] Có kill switch cho AI/remote selector, local fallback, runbook carrier DOM change, rollback package và quy trình báo/xử lý sự cố dữ liệu.
- [ ] Mỗi release kiểm tra lại Privacy tab, permissions, listing và policy; item đã publish vẫn có thể bị review định kỳ.

## 9. Lộ trình 90 ngày khuyến nghị

| Giai đoạn | Mục tiêu ra quyết định | Deliverable |
| --- | --- | --- |
| Ngày 0–14 | Có đủ điều kiện policy/privacy để pilot | Permission/data-flow audit; consent; public policies; account/asset checklist; pricing hypothesis. |
| Ngày 15–30 | Chứng minh giá trị với 5–10 shop | Private build; reviewer/demo flow; đo thời gian tiết kiệm và lỗi điền form; phỏng vấn willingness-to-pay. |
| Ngày 31–45 | Sẵn sàng public Việt Nam | Fix P0/P1; checkout/entitlement; support/refund flow; listing hoàn chỉnh; submit deferred. |
| Ngày 46–90 | Tìm product-market fit và giảm rủi ro vận hành | Cohort activation/conversion/churn; tối ưu onboarding; Team plan; release cadence và policy re-audit. |

**Nguyên tắc thương mại hoá:** doanh thu nên đến từ quota, AI/cloud sync, cộng tác đội nhóm, audit/approval và support—không từ bán dữ liệu, quảng cáo dựa trên dữ liệu đơn hàng hay mở rộng quyền duyệt web ngoài mục đích điền vận đơn.

## Nguồn chính thức cốt lõi

- [Chrome Web Store Program Policies](https://developer.chrome.com/docs/webstore/program-policies/policies)
- [Manifest V3 requirements](https://developer.chrome.com/docs/webstore/program-policies/mv3-requirements)
- [User Data FAQ](https://developer.chrome.com/docs/webstore/program-policies/user-data-faq)
- [Limited Use](https://developer.chrome.com/docs/webstore/program-policies/limited-use)
- [Register developer account](https://developer.chrome.com/docs/webstore/register)
- [Prepare your extension](https://developer.chrome.com/docs/webstore/prepare)
- [Publish](https://developer.chrome.com/docs/webstore/publish)
- [Review process](https://developer.chrome.com/docs/webstore/review-process)
- [Chrome Web Store review updates 2026](https://developer.chrome.com/blog/cws-review-updates-2026)
- [Store listing](https://developer.chrome.com/docs/webstore/cws-dashboard-listing)
- [Image requirements](https://developer.chrome.com/docs/webstore/images)
- [Distribution](https://developer.chrome.com/docs/webstore/cws-dashboard-distribution)
- [Developer Agreement](https://developer.chrome.com/docs/webstore/program-policies/terms)
- [Luật Bảo vệ dữ liệu cá nhân 91/2025/QH15](https://vanban.chinhphu.vn/?docid=214590&pageid=27160&typegroupid=3)
- [Nghị định 356/2025/NĐ-CP](https://vanban.chinhphu.vn/?docid=216387&pageid=27160&typegroupid=4)
- [Luật Thương mại điện tử 122/2025/QH15](https://vanban.chinhphu.vn/?classid=1&docid=216503&pageid=27160&typegroupid=3)
- [Luật Bảo vệ quyền lợi người tiêu dùng 19/2023/QH15](https://vanban.chinhphu.vn/?classid=1&docid=208363&orggroupid=1&pageid=27160&previousPage=other+articles)
