import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import '../services/user_service.dart';
import '../services/storage_service.dart';
import 'package:image_picker/image_picker.dart';
import 'package:firebase_auth/firebase_auth.dart';

class HomeScreen extends StatefulWidget {
  const HomeScreen({super.key});

  @override
  State<HomeScreen> createState() => _HomeScreenState();  
}

class _HomeScreenState extends State<HomeScreen> {
  final _storageService = StorageService();
  final _userService = UserService();
  final _picker = ImagePicker();

  List<String> _imageUrls = [];
  bool _isLoadingImages = true;
  bool _isUploading = false;
  static const int freeLimit = 3;

  String _uid = FirebaseAuth.instance.currentUser?.uid ?? '';

  @override
  void initState() {
    super.initState();
    _loadImages();
  }

  Future<void> _loadImages() async {
    setState(() {
      _isLoadingImages = true;
    });

    final urls = await _storageService.listUserImages(uid: _uid);
    setState(() {
      _imageUrls = urls;
      _isLoadingImages = false;
    });
  }


  Future<void> _pickAndUploadImage(bool _isPremium) async {
    if(!_isPremium && _imageUrls.length >= freeLimit) {
      ScaffoldMessenger.of(context).showSnackBar(
        const SnackBar(content: Text('Free users can only upload up to 3 images. Please upgrade to premium for more uploads.')),
      );
      return;
    }

    final pickedFile = await _picker.pickImage(source: ImageSource.gallery);
    if (pickedFile != null) {
      try {
        final bytes = await pickedFile.readAsBytes();
        await _storageService.uploadImage(uid: _uid, fileName: pickedFile.name, bytes: bytes);
        await _loadImages();
      } on FirebaseException catch (e) {
        ScaffoldMessenger.of(context).showSnackBar(
          SnackBar(content: Text('Failed to upload image: ${e.message}')),
        );
      } finally {
        setState(() {
          _isUploading = false;
        });
      }
    }
  }
}