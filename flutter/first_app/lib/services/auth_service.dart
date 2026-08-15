import 'package:firebase_auth/firebase_auth.dart';
import 'user_service.dart';

class AuthService {
  final FirebaseAuth _auth = FirebaseAuth.instance;

  // exposes the current logged-in user, or null if signed out
  User? get currentUser => _auth.currentUser;
  final _userService = UserService();

  // exposes a stream of auth state changes — fires whenever login/logout happens
  Stream<User?> get authStateChanges => _auth.authStateChanges();

  Future<void> signIn({required String email, required String password}) async {
    await _auth.signInWithEmailAndPassword(email: email, password: password);
  } 

  Future<void> signUp({required String email, required String password}) async {
    final credential = await _auth.createUserWithEmailAndPassword(email: email, password: password);
    print('User signed up: ${credential.user?.uid}');
    await _userService.createUserDoc(credential.user!.uid);
  }

  Future<void> signOut() async {
    await _auth.signOut();
  }
}