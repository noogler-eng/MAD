import 'dart:typed_data';
import 'package:firebase_auth/firebase_auth.dart';
import 'package:firebase_storage/firebase_storage.dart';

class StorageService {
  final FirebaseStorage _storage = FirebaseStorage.instance;


  Future<String> uploadImage({
    required String uid,
    required String fileName,
    required Uint8List bytes,
  }) async {
    final storageRef = _storage.ref().child('images/$uid/$fileName');
    final uploadTask = await storageRef.putData(bytes);
    return uploadTask.ref.getDownloadURL();
  }

  Future<List<String>> listUserImages({
    required String uid,
  }) async {
    await FirebaseAuth.instance.currentUser?.reload();
    final storageRef = _storage.ref().child('images/$uid');
    final listResult = await storageRef.listAll();
    final urls = await Future.wait(listResult.items.map((item) => item.getDownloadURL()));
    return urls;
  }
}