import 'package:cloud_firestore/cloud_firestore.dart';

class UserService {
  final CollectionReference _users = FirebaseFirestore.instance.collection('users');

  Future<void> createUserDoc(String uid) async {
    await _users.doc(uid).set({
      'isPremium': false,
    });
  }

  // live stream for premium status
  Stream<bool> getPremiumStream(String uid) {
    return _users.doc(uid).snapshots().map((doc) {
      final data = doc.data() as Map<String, dynamic>?;
      return data?['isPremium'] ?? false;
    });
  }

  Future<void> updatePremiumStatus(String uid, bool isPremium) async {
    await _users.doc(uid).update({
      'isPremium': isPremium,
    });
  }

}