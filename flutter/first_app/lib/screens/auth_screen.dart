import 'package:flutter/material.dart';
import '../services/auth_service.dart';
import 'package:firebase_auth/firebase_auth.dart';

class AuthScreen extends StatefulWidget {
  const AuthScreen({super.key});

  @override
  State<AuthScreen> createState() => _AuthScreenState();
}

class _AuthScreenState extends State<AuthScreen> {
  final _authService = AuthService();
  final _formKey = GlobalKey<FormState>();
  final _emailController = TextEditingController();
  final _passwordController = TextEditingController();

  // switching between login and sign up modes
  bool _isLogin = true;
  bool _isLoading = false;
  String? _errorMessage;

  Future<void> _submit() async {
    if(!_formKey.currentState!.validate()){
      return;
    }

    setState(() {
      _isLoading = true;
      _errorMessage = null;
    });

    try{
      if(_isLogin){
        await _authService.signIn(
          email: _emailController.text.trim(),
          password: _passwordController.text.trim(),
        );
      } else {
        await _authService.signUp(
          email: _emailController.text.trim(),
          password: _passwordController.text.trim(),
        );
      }
      // no manual navigation here — main.dart's StreamBuilder reacts automatically
    } on FirebaseAuthException catch (e) {
      print('FirebaseAuthException: ${e.message}');
      setState(() {
        _errorMessage = e.message;
      });
    } catch (e) {
      print('Unexpected error: $e');
      setState(() {
        _errorMessage = 'An unexpected error occurred';
      });
    } finally {
      setState(() {
        _isLoading = false;
      });
    }
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        title: Text(_isLogin ? 'Login' : 'Sign Up'),
      ),
      body: Padding(
        padding: const EdgeInsets.all(24.0),
        child: Form(
          key: _formKey,
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              TextFormField(
                controller: _emailController,
                decoration: const InputDecoration(labelText: 'Email'),
                keyboardType: TextInputType.emailAddress,
                validator: (value) {
                  if(value == null || value.isEmpty) {
                    return 'Please enter your email';
                  }
                  return null;
                }
              ),
              const SizedBox(height: 16.0),
              TextFormField(
                controller: _passwordController,
                decoration: const InputDecoration(labelText: 'Password'),
                obscureText: true,
                validator: (value) {
                  if(value == null || value.isEmpty) {
                    return 'Please enter your password';
                  }
                  return null;
                }
              ),
              const SizedBox(height: 16.0),
              
              if(_errorMessage != null) Text(
                _errorMessage!,
                style: const TextStyle(color: Colors.red),
              ),

              const SizedBox(height: 16.0),
              _isLoading ? const CircularProgressIndicator() : ElevatedButton(
                onPressed: _submit,
                child: Text(_isLogin ? 'Login' : 'Sign Up'),
              ),
              TextButton(
                onPressed: () {
                  setState(() {
                    _isLogin = !_isLogin;
                    _errorMessage = null; 
                  });
                },
                child: Text(_isLogin ? 'Create an account' : 'Already have an account? Login'),
              ),
            ]
          )
        )
      )
    );
  }
}