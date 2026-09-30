# Feature Specification: Đăng nhập nhân viên bằng PIN và quản lý thiết bị tin cậy

**Feature Branch**: `003-employee-pin-device-access`

**Created**: 2026-08-29

**Status**: Ready for Planning

**Input**: Máy cũ chỉ cần username + PIN; máy mới cần thêm Mã Shop và có thể cần Chủ Shop duyệt. Chủ Shop cần quản lý nhân viên và thiết bị nhanh, rõ ràng, không làm mất lịch sử đơn hàng.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Nhân viên đăng nhập nhanh trên máy tin cậy (Priority: P1)

Nhân viên đã từng được Chủ Shop cho phép dùng một máy có thể mở Extension, nhập tên đăng nhập và PIN để vào đúng Shop. Hệ thống tự nhận biết Shop từ thiết bị, không yêu cầu nhập lại Mã Shop, email hay mật khẩu dài.

**Why this priority**: Đây là luồng được dùng hằng ngày và phải giảm tối đa thao tác nhưng vẫn giữ đúng danh tính nhân viên lên đơn.

**Independent Test**: Đăng ký một thiết bị cho một nhân viên, đóng và mở lại Extension, đăng nhập bằng username + PIN, sau đó kiểm tra đúng Shop, đúng nhân viên, đúng quyền và đúng thiết bị.

**Acceptance Scenarios**:

1. **Given** thiết bị đang ở trạng thái tin cậy cho Shop và nhân viên đang hoạt động, **When** nhân viên nhập đúng username + PIN, **Then** hệ thống đăng nhập vào đúng Shop và hiển thị đúng tên nhân viên.
2. **Given** thiết bị tin cậy nhưng PIN sai, **When** nhân viên đăng nhập, **Then** hệ thống từ chối bằng thông báo chung, không tiết lộ username hay PIN sai.
3. **Given** thiết bị đã bị thu hồi, **When** nhân viên nhập đúng username + PIN, **Then** hệ thống không cho truy cập và chuyển sang luồng thiết bị mới hoặc liên hệ Chủ Shop.
4. **Given** nhân viên đã bị khóa hoặc rời Shop, **When** đăng nhập từ thiết bị từng tin cậy, **Then** hệ thống từ chối và không khôi phục quyền thiết bị.

---

### User Story 2 - Đăng nhập an toàn trên máy mới (Priority: P1)

Trên thiết bị chưa biết Shop, nhân viên nhập Mã Shop + username + PIN. Nếu Shop yêu cầu duyệt, thiết bị chuyển sang chờ Chủ Shop duyệt; nếu Shop cho phép tự duyệt và còn hạn mức, thiết bị được kích hoạt theo chính sách.

**Why this priority**: Đây là cửa ngõ thêm thiết bị và là điểm rủi ro cao nhất đối với việc chia sẻ PIN hoặc chiếm quyền truy cập Shop.

**Independent Test**: Dùng một cài đặt Extension mới, đăng nhập bằng Mã Shop + username + PIN và kiểm tra riêng hai chính sách: chờ duyệt và tự duyệt trong hạn mức.

**Acceptance Scenarios**:

1. **Given** thiết bị mới và Shop bật duyệt thủ công, **When** thông tin đăng nhập đúng, **Then** yêu cầu thiết bị được tạo ở trạng thái chờ duyệt và nhân viên chưa được vào workspace.
2. **Given** yêu cầu đang chờ, **When** Chủ Shop duyệt, **Then** thiết bị trở thành tin cậy và nhân viên có thể tiếp tục đăng nhập mà không nhập lại Mã Shop.
3. **Given** thiết bị mới và Shop bật tự duyệt trong hạn mức, **When** thông tin đúng và còn hạn mức, **Then** thiết bị được kích hoạt và sự kiện tự duyệt được ghi nhận.
4. **Given** Shop đã hết hạn mức thiết bị, **When** nhân viên đăng nhập trên máy mới, **Then** hệ thống không tự duyệt và hướng dẫn chờ Chủ Shop xử lý.
5. **Given** Mã Shop, username hoặc PIN không đúng, **When** gửi yêu cầu, **Then** hệ thống trả một thông báo lỗi chung và không tiết lộ thành phần nào tồn tại.

---

### User Story 3 - Chủ Shop cấp và quản lý tài khoản PIN (Priority: P1)

Chủ Shop tạo username cho nhân viên, thiết lập hoặc đặt lại PIN, xem trạng thái tài khoản và khóa quyền truy cập mà không xóa lịch sử nhân viên hoặc đơn hàng.

**Why this priority**: Luồng nhân viên chỉ an toàn khi Chủ Shop có thể cấp, phục hồi và thu hồi quyền ngay lập tức.

**Independent Test**: Tạo một nhân viên, cấp username + PIN, đăng nhập thành công, đặt lại PIN, xác nhận PIN cũ hết hiệu lực và khóa nhân viên để xác nhận mọi thiết bị bị từ chối.

**Acceptance Scenarios**:

1. **Given** một nhân viên đang hoạt động, **When** Chủ Shop cấp username duy nhất và PIN hợp lệ, **Then** nhân viên có thể dùng thông tin đó để đăng nhập theo chính sách thiết bị.
2. **Given** PIN vừa được tạo hoặc đặt lại, **When** màn hình xác nhận đóng, **Then** hệ thống không hiển thị lại PIN cũ ở bất kỳ màn hình quản trị nào.
3. **Given** Chủ Shop đặt lại PIN, **When** nhân viên dùng PIN cũ, **Then** hệ thống từ chối; PIN mới hoạt động theo chính sách phiên hiện hành.
4. **Given** Chủ Shop khóa nhân viên hoặc gỡ nhân viên khỏi Shop, **When** thao tác hoàn tất, **Then** tất cả phiên thiết bị của nhân viên tại Shop đó bị thu hồi nhưng lịch sử đơn vẫn giữ nguyên.

---

### User Story 4 - Chủ Shop duyệt và thu hồi thiết bị (Priority: P2)

Chủ Shop xem danh sách thiết bị theo các nhóm Chờ duyệt, Đang hoạt động và Đã thu hồi; có thể đặt tên dễ nhớ, duyệt, từ chối hoặc thu hồi từng thiết bị.

**Why this priority**: Giúp kiểm soát quyền truy cập thực tế mà không nhầm thiết bị với nhân viên và không cần xóa tài khoản.

**Independent Test**: Tạo hai yêu cầu thiết bị mới, duyệt một và từ chối một, sau đó thu hồi thiết bị đã duyệt và kiểm tra phiên bị chặn ngay lần xác thực kế tiếp.

**Acceptance Scenarios**:

1. **Given** một yêu cầu thiết bị đang chờ, **When** Chủ Shop duyệt và đặt tên thiết bị, **Then** thiết bị xuất hiện trong danh sách hoạt động với người duyệt và thời điểm duyệt.
2. **Given** một thiết bị đang hoạt động, **When** Chủ Shop thu hồi, **Then** mọi phiên trên thiết bị đó của Shop bị vô hiệu và thiết bị không tự trở lại trạng thái tin cậy.
3. **Given** một thiết bị dùng chung, **When** nhân viên A đăng xuất và nhân viên B đăng nhập, **Then** thiết bị không đổi danh tính nhưng phiên và đơn mới được ghi cho nhân viên B.

---

### User Story 5 - Giữ đúng người và máy đã lên từng đơn (Priority: P2)

Mỗi đơn được tạo phải lưu đúng Shop, đúng nhân viên thực hiện và đúng thiết bị nguồn. Việc đổi PIN, đổi tên thiết bị, thu hồi thiết bị hoặc gỡ nhân viên không được ghi đè lịch sử này.

**Why this priority**: Đây là dữ liệu đối soát và truy trách nhiệm; sai danh tính đơn hàng sẽ làm sai báo cáo Shop và lịch sử khách hàng.

**Independent Test**: Hai nhân viên lần lượt dùng cùng thiết bị để tạo hai đơn có mã khác nhau, sau đó khóa một nhân viên và đổi tên thiết bị; kiểm tra hai đơn vẫn giữ nguyên danh tính ban đầu.

**Acceptance Scenarios**:

1. **Given** nhân viên đã đăng nhập hợp lệ, **When** tạo đơn mới, **Then** đơn lưu bất biến người gửi và thiết bị nguồn tại thời điểm tạo.
2. **Given** một khách cũ mua lại với mã đơn mới, **When** tạo đơn, **Then** hệ thống tạo bản ghi mới và không cập nhật đè đơn cũ.
3. **Given** nhân viên hoặc thiết bị sau đó bị thu hồi, **When** xem lịch sử đơn, **Then** thông tin nguồn của đơn vẫn còn để đối soát.

---

### User Story 6 - Chuyển đổi máy đang dùng Shop Key (Priority: P3)

Các máy đã kích hoạt theo cơ chế Shop Key được hướng dẫn liên kết với một nhân viên thật và chuyển sang username + PIN mà không mất cấu hình hoặc lịch sử đơn.

**Why this priority**: Cần thiết để loại bỏ cơ chế cũ nhưng không làm gián đoạn vận hành của Shop đang dùng Extension.

**Independent Test**: Mở một cài đặt cũ có Shop Key, thực hiện liên kết nhân viên, đăng nhập lại bằng PIN và xác nhận giữ nguyên Shop, thiết bị và lịch sử đơn.

**Acceptance Scenarios**:

1. **Given** máy cũ đang có kích hoạt Shop Key hợp lệ, **When** nhân viên bắt đầu chuyển đổi, **Then** hệ thống nhận đúng Shop nhưng vẫn yêu cầu liên kết với một thành viên đang hoạt động.
2. **Given** chuyển đổi thành công, **When** mở lại Extension, **Then** Shop Key không còn được dùng như thông tin đăng nhập thường xuyên.
3. **Given** chuyển đổi thất bại hoặc bị hủy, **When** người dùng quay lại, **Then** không tạo phiên nhân viên sai và không làm mất dữ liệu thiết bị hiện có.

### Edge Cases

- Một username giống nhau có thể tồn tại ở hai Shop khác nhau; trên thiết bị mới phải dùng Mã Shop để xác định đúng phạm vi.
- Một thiết bị đã tin cậy với nhiều Shop phải yêu cầu người dùng chọn Shop trước khi chỉ nhập username + PIN.
- Xóa dữ liệu trình duyệt hoặc cài lại Extension làm mất nhận diện máy cục bộ; hệ thống phải xem đây là thiết bị mới, không đoán theo tên máy hoặc dấu vân tay trình duyệt.
- Thay đổi trình duyệt, độ phân giải, ngôn ngữ hoặc địa chỉ mạng không được tự tạo thiết bị mới khi mã cài đặt ổn định vẫn còn.
- Hai yêu cầu đăng nhập đồng thời trên cùng thiết bị phải không tạo trùng thiết bị hoặc nhiều yêu cầu chờ giống nhau.
- PIN sai liên tiếp phải kích hoạt khóa tạm thời; khóa không được tiết lộ username có tồn tại hay không.
- Yêu cầu duyệt hết hạn phải được tạo lại thay vì tự kích hoạt từ yêu cầu cũ.
- Chủ Shop không được thu hồi thiết bị/phiên cuối cùng của chính mình nếu thao tác đó làm Shop không còn đường quản trị, trừ khi đã xác nhận phương án khôi phục.
- Phiên bị thu hồi trong lúc panel đang mở phải bị chặn ở lần kiểm tra kế tiếp và UI phải chuyển về đăng nhập mà không cần tải lại trang vận chuyển.
- Mất mạng không được biến trạng thái chờ duyệt hoặc bị thu hồi thành trạng thái được phép.
- Nhân viên đổi username phải không thay đổi định danh lịch sử và PIN hiện tại chỉ tiếp tục dùng nếu Chủ Shop không yêu cầu đặt lại.
- Mã Shop không được coi là bí mật đủ để tự cấp quyền; nó chỉ dùng để định tuyến đến đúng Shop.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: Hệ thống MUST phân biệt độc lập thành viên Shop, cài đặt thiết bị và phiên truy cập thiết bị.
- **FR-002**: Mỗi username MUST duy nhất trong phạm vi một Shop sau khi chuẩn hóa, nhưng MAY được dùng lại ở Shop khác.
- **FR-003**: Nhân viên trên thiết bị tin cậy MUST có thể đăng nhập bằng username + PIN mà không nhập Mã Shop khi thiết bị chỉ gắn với một Shop.
- **FR-004**: Thiết bị chưa xác định Shop MUST yêu cầu Mã Shop + username + PIN.
- **FR-005**: Khi một thiết bị tin cậy với nhiều Shop, hệ thống MUST yêu cầu chọn Shop trước khi xác minh username + PIN.
- **FR-006**: Mã Shop MUST chỉ dùng để xác định Shop và MUST NOT tự cấp quyền truy cập.
- **FR-007**: Shop MUST có chính sách duyệt thiết bị mới gồm ít nhất `Chủ Shop duyệt` và `Tự duyệt khi còn hạn mức`.
- **FR-008**: Chính sách mặc định của Shop mới và Shop chưa cấu hình MUST là `Chủ Shop duyệt`.
- **FR-009**: Thiết bị chờ duyệt, bị từ chối, bị thu hồi hoặc vượt hạn mức MUST NOT được truy cập workspace hoặc gửi đơn lên cloud.
- **FR-010**: Hệ thống MUST chỉ lưu phiên đăng nhập hoạt động sau khi đồng thời xác minh đúng nhân viên, đúng Shop và quyền thiết bị.
- **FR-011**: Hệ thống MUST xóa thông tin phiên tạm nếu bước cấp quyền thiết bị không hoàn tất.
- **FR-012**: Chủ Shop MUST có thể tạo, đổi và vô hiệu username của nhân viên mà không xóa hồ sơ thành viên.
- **FR-013**: PIN nhân viên MUST gồm đúng 6 chữ số trong phiên bản đầu tiên.
- **FR-014**: PIN MUST được lưu ở dạng không thể đọc lại; màn hình quản trị chỉ được hiển thị PIN rõ một lần khi tạo hoặc đặt lại.
- **FR-015**: Sau 5 lần xác minh thất bại liên tiếp trong một phạm vi bảo vệ, hệ thống MUST khóa tạm thời việc thử lại tối thiểu 15 phút.
- **FR-016**: Thông báo đăng nhập thất bại MUST dùng nội dung chung, không xác nhận riêng Mã Shop, username hay PIN có tồn tại.
- **FR-017**: Chủ Shop MUST có thể đặt lại PIN; PIN cũ MUST hết hiệu lực ngay khi thay đổi thành công.
- **FR-018**: Chủ Shop MUST có thể xem thiết bị theo trạng thái, đặt tên hiển thị, duyệt, từ chối và thu hồi thiết bị.
- **FR-019**: Thu hồi thiết bị MUST vô hiệu mọi phiên của Shop trên thiết bị đó mà không xóa bản ghi thiết bị hoặc lịch sử đơn.
- **FR-020**: Khóa hoặc gỡ nhân viên khỏi Shop MUST vô hiệu mọi phiên Shop của nhân viên đó mà không xóa lịch sử đơn.
- **FR-021**: Hệ thống MUST dùng một định danh cài đặt ổn định và thống nhất cho mọi luồng đăng nhập, đồng bộ và ghi nguồn đơn.
- **FR-022**: Dấu vân tay môi trường MAY hỗ trợ nhận diện rủi ro nhưng MUST NOT thay thế định danh cài đặt hoặc được xem là bằng chứng duy nhất để tin cậy máy.
- **FR-023**: Mỗi phiên MUST được ràng buộc với đúng Shop, nhân viên và thiết bị, có thời hạn và trạng thái thu hồi.
- **FR-024**: Extension MUST kiểm tra hiệu lực phiên khi khởi động, khi trạng thái xác thực thay đổi và định kỳ trong lúc hoạt động.
- **FR-025**: Khi phiên hoặc thiết bị mất quyền, panel và Options MUST tự chuyển về trạng thái đăng nhập phù hợp mà không yêu cầu tải lại trang vận chuyển.
- **FR-026**: Chủ Shop/Admin MUST tiếp tục dùng cơ chế đăng nhập mạnh hiện tại; PIN nhân viên MUST NOT thay thế mật khẩu quản trị.
- **FR-027**: Cơ chế xác minh PIN MUST không cho phép client tự đặt lại mật khẩu hoặc nâng quyền người dùng.
- **FR-028**: Lỗi tải quyền hoặc lỗi máy chủ MUST thất bại an toàn và MUST NOT tự cấp quyền quản trị hay toàn quyền.
- **FR-029**: Mọi thao tác tạo/đặt lại PIN, thử đăng nhập, khóa tạm, duyệt/từ chối/thu hồi thiết bị và thu hồi phiên MUST được ghi nhật ký với người thực hiện, Shop, thiết bị và thời gian phù hợp.
- **FR-030**: Dữ liệu nhật ký MUST không chứa PIN rõ, mã phiên đầy đủ hoặc bí mật đăng nhập.
- **FR-031**: Mỗi đơn mới MUST lưu bất biến Shop, người thực hiện và thiết bị nguồn tại thời điểm tạo.
- **FR-032**: Tên, số điện thoại, địa chỉ hoặc COD của khách hàng MUST NOT được dùng làm định danh duy nhất của đơn hàng.
- **FR-033**: Khách hàng quay lại với mã đơn mới MUST tạo đơn mới thay vì ghi đè đơn trước.
- **FR-034**: Máy dùng Shop Key cũ MUST có luồng chuyển đổi có kiểm soát sang một thành viên thật trước khi cơ chế cũ bị tắt.
- **FR-035**: Sau giai đoạn chuyển đổi, Shop Key MUST NOT còn là thông tin đăng nhập thường xuyên hoặc được hiển thị như bí mật có thể tái sử dụng.
- **FR-036**: Quá trình chuyển đổi MUST giữ nguyên quan hệ Shop, thiết bị, cấu hình và lịch sử nguồn đơn hiện có.
- **FR-037**: Hệ thống MUST ngăn tạo trùng thiết bị và trùng yêu cầu chờ khi người dùng gửi lại hoặc mạng lặp yêu cầu.
- **FR-038**: Mọi thay đổi dữ liệu phục vụ feature MUST có đường nâng cấp lặp lại an toàn và không phụ thuộc vào việc xóa dữ liệu sản xuất.

### Key Entities

- **Shop**: Phạm vi tổ chức sở hữu nhân viên, thiết bị, chính sách duyệt và hạn mức.
- **Shop Member**: Quan hệ một người dùng với một Shop, gồm vai trò và trạng thái; tồn tại độc lập với thiết bị.
- **Employee PIN Credential**: Username trong Shop, thông tin xác minh PIN không thể đọc lại, số lần thất bại, khóa tạm và thời điểm thay đổi.
- **Extension Device**: Một cài đặt Extension ổn định, có tên hiển thị, thông tin môi trường và vòng đời riêng; không đại diện cho một nhân viên.
- **Device Access**: Quyền của một thiết bị đối với một Shop, gồm trạng thái chờ/hoạt động/từ chối/thu hồi và thông tin người duyệt.
- **Device Session**: Phiên có thời hạn gắn đồng thời với Shop, thành viên và thiết bị, có thể thu hồi độc lập.
- **Login Challenge**: Yêu cầu xác minh ngắn hạn, dùng một lần để nối việc xác minh PIN với việc cấp một phiên hợp lệ.
- **Authentication Audit Event**: Nhật ký bất biến của các quyết định đăng nhập, khóa PIN, duyệt thiết bị và thu hồi quyền.
- **Submitted Order Attribution**: Thông tin bất biến trên đơn về Shop, nhân viên và thiết bị đã thực hiện thao tác.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Ít nhất 95% nhân viên đăng nhập thành công trên máy tin cậy trong dưới 10 giây và không cần Mã Shop, email hoặc mật khẩu dài.
- **SC-002**: 100% thiết bị mới thuộc Shop bật duyệt thủ công không thể vào workspace trước khi Chủ Shop duyệt.
- **SC-003**: 100% lần thu hồi thiết bị hoặc khóa nhân viên chặn phiên bị ảnh hưởng trong lần kiểm tra quyền kế tiếp, không cần tải lại Extension.
- **SC-004**: 100% đơn tạo sau khi triển khai có thể đối chiếu về đúng Shop, đúng nhân viên và đúng thiết bị nguồn.
- **SC-005**: Không có trường hợp khách mua lại với mã đơn mới làm ghi đè đơn cũ trong bộ kiểm thử hồi quy.
- **SC-006**: Không có PIN rõ, mã phiên đầy đủ hoặc thông tin đăng nhập có thể tái sử dụng xuất hiện trong dữ liệu quản trị, log hoặc thông báo lỗi.
- **SC-007**: Sau 5 lần thử sai liên tiếp, lần thử tiếp theo luôn bị khóa theo chính sách trong toàn bộ các giao diện đăng nhập.
- **SC-008**: Chủ Shop có thể duyệt hoặc thu hồi một thiết bị trong tối đa 3 thao tác từ trang quản lý thiết bị.
- **SC-009**: Ít nhất 99% máy Shop Key đủ điều kiện hoàn tất chuyển đổi mà không mất cấu hình Shop hoặc lịch sử đơn.
- **SC-010**: Các lỗi máy chủ, tải quyền hoặc mất mạng không tạo ra bất kỳ phiên có quyền cao hơn quyền thực của người dùng.

## Assumptions

- Phiên bản đầu tiên dùng PIN 6 chữ số để tối ưu tốc độ nhập; bảo vệ chính đến từ giới hạn thử, khóa tạm, thiết bị tin cậy và khả năng thu hồi.
- Chính sách mặc định là Chủ Shop duyệt thiết bị mới. Shop có thể chủ động bật tự duyệt nếu còn hạn mức.
- Mã Shop có thể chia sẻ cho nhân viên và không được xem là bí mật độc lập.
- Chủ Shop và quản trị viên vẫn dùng tài khoản có mật khẩu mạnh; xác thực bổ sung cho nhóm này có thể triển khai riêng.
- Máy cũ là cài đặt còn giữ định danh ổn định và có quyền thiết bị đang hoạt động; chỉ trùng dấu vân tay không đủ để coi là máy cũ.
- Một thiết bị vật lý có thể dùng chung cho nhiều nhân viên; mỗi lần đăng nhập tạo phiên theo đúng nhân viên hiện tại.
- Việc chờ duyệt thiết bị không giữ một phiên workspace có thể sử dụng; người dùng có thể kiểm tra trạng thái bằng yêu cầu giới hạn quyền.
- Lịch sử bảo mật được giữ theo chính sách vận hành hiện có và không chứa bí mật có thể dùng để đăng nhập.
- Thanh toán, triển khai Payment Webhook và Telegram Bot không thuộc phạm vi feature này.
