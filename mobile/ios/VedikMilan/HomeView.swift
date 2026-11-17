import SwiftUI
import SafariServices
import UIKit

private enum Destination: String, Identifiable {
    case discover = "/", post = "/post", kundali = "/kundali-milan", account = "/account", privacy = "/terms"
    var id: String { rawValue }
    var url: URL { URL(string: "https://vedik-milan.softinator.org" + rawValue)! }
}

struct HomeView: View {
    @Environment(\.openURL) private var openURL
    @State private var destination: Destination?
    @State private var failedToLoad = false
    private let plum = Color(red: 104/255, green: 56/255, blue: 76/255)

    var body: some View {
        NavigationStack {
            ScrollView {
                VStack(alignment: .leading, spacing: 24) {
                    HStack(spacing: 16) {
                        Image("AppLogo").resizable().frame(width: 64, height: 64).clipShape(RoundedRectangle(cornerRadius: 16))
                        VStack(alignment: .leading, spacing: 4) {
                            Text("वैदिक मिलन").font(.largeTitle.bold())
                            Text("निःशुल्क ब्राह्मण विवाह").foregroundStyle(.secondary)
                        }
                    }
                    Text("अपनी पसंद और परिवार के मूल्यों के साथ जीवनसाथी की खोज करें।").font(.title3)
                    if failedToLoad {
                        Text("वेबसाइट नहीं खुली। इंटरनेट जाँचें और फिर प्रयास करें, या नीचे Safari में खोलें।")
                            .foregroundStyle(.red)
                    }
                    VStack(spacing: 12) {
                        action("रिश्ते खोजें", icon: "person.2", destination: .discover)
                        action("प्रोफ़ाइल बनाएँ", icon: "person.crop.circle.badge.plus", destination: .post)
                        action("कुण्डली मिलान और PDF", icon: "moon.stars", destination: .kundali)
                        action("मेरा खाता", icon: "person.crop.circle", destination: .account)
                    }
                    VStack(alignment: .leading, spacing: 12) {
                        Text("सहायता").font(.headline)
                        Text("बायोडाटा पोस्ट करने में दिक़्क़त हो तो Admin से संपर्क करें।")
                        Link("Admin: 9131591131", destination: URL(string: "tel:+919131591131")!)
                        Text("PDF डाउनलोड या साझा करने में दिक़्क़त हो तो वेबसाइट Safari में खोलें।").font(.footnote).foregroundStyle(.secondary)
                        Button("Safari में वेबसाइट खोलें") { openURL(Destination.discover.url) }
                        ShareLink(item: Destination.discover.url) { Label("वैदिक मिलन साझा करें", systemImage: "square.and.arrow.up") }
                        Button("नियम और गोपनीयता") { show(.privacy) }
                    }
                    .frame(maxWidth: .infinity, alignment: .leading).padding(20)
                    .background(Color(uiColor: .secondarySystemGroupedBackground), in: RoundedRectangle(cornerRadius: 16))
                    Text("इंटरनेट आवश्यक है। प्रोफ़ाइल की जानकारी सदस्यों द्वारा दी गई है; रिश्ता आगे बढ़ाने से पहले पुष्टि करें।")
                        .font(.footnote).foregroundStyle(.secondary)
                }.padding(24).frame(maxWidth: 640)
            }
            .background(Color(uiColor: .systemGroupedBackground))
            .tint(plum)
            .navigationTitle("वैदिक मिलन").navigationBarTitleDisplayMode(.inline)
            .sheet(item: $destination) { page in
                WebsiteView(url: page.url) { failedToLoad = true; destination = nil }
                    .ignoresSafeArea()
            }
        }
    }
    private func show(_ page: Destination) { failedToLoad = false; destination = page }
    private func action(_ title: String, icon: String, destination: Destination) -> some View {
        Button { show(destination) } label: {
            HStack(spacing: 14) {
                Image(systemName: icon).font(.title2).frame(width: 30)
                Text(title).font(.headline).multilineTextAlignment(.leading)
                Spacer(minLength: 4)
                Image(systemName: "chevron.right").accessibilityHidden(true)
            }.padding(18).frame(maxWidth: .infinity, minHeight: 60)
        }.buttonStyle(.bordered).controlSize(.large)
    }
}

private struct WebsiteView: UIViewControllerRepresentable {
    let url: URL
    let onFailure: () -> Void
    func makeCoordinator() -> Coordinator { Coordinator(onFailure: onFailure) }
    func makeUIViewController(context: Context) -> SFSafariViewController {
        let configuration = SFSafariViewController.Configuration()
        configuration.entersReaderIfAvailable = false
        let controller = SFSafariViewController(url: url, configuration: configuration)
        controller.delegate = context.coordinator
        controller.preferredControlTintColor = UIColor(red: 104/255, green: 56/255, blue: 76/255, alpha: 1)
        controller.dismissButtonStyle = .close
        return controller
    }
    func updateUIViewController(_ controller: SFSafariViewController, context: Context) {}
    final class Coordinator: NSObject, SFSafariViewControllerDelegate {
        let onFailure: () -> Void
        init(onFailure: @escaping () -> Void) { self.onFailure = onFailure }
        func safariViewController(_ controller: SFSafariViewController, didCompleteInitialLoad didLoadSuccessfully: Bool) {
            if !didLoadSuccessfully { DispatchQueue.main.async { self.onFailure() } }
        }
    }
}
