import 'package:flutter/material.dart';
// import for debugging purposes
import 'package:flutter/foundation.dart';

// Entry point of the application
// MyApp - The root widget of the application
void main() {
  runApp(const MyApp());
}

// Root widget of the application
// Widget - stateless or stateful
// always need to override the build method to describe how to display the widget in terms of other, lower-level widgets.

// stateless widget - a widget with no internal mutable data. Given the same inputs, it always produces the same UI.
class MyApp extends StatelessWidget {
  const MyApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'Flutter Demo',
      theme: ThemeData(
        colorScheme: ColorScheme.fromSeed(seedColor: Colors.deepPurple),
      ),

      // MyHomePage class is called
      home: const MyHomePage(title: 'Flutter Demo Home Page'),
    );
  }
}

// stateful widget
// combination of mutable and immutable widgets
// MyHomePage + _MyHomePageState
class MyHomePage extends StatefulWidget {
  const MyHomePage({super.key, required this.title});

  final String title;

  // createState() - creates the mutable state for this widget at a given location in the tree//
  @override
  State<MyHomePage> createState() => _MyHomePageState();
}

class _MyHomePageState extends State<MyHomePage> {
  // widget state
  int _counter = 0;

  // normal function to increment the counter
  void _incrementCounter() {
    print('Incrementing counter from $_counter to ${_counter + 1}');
    setState(() {
      debugPrint('inside setState - Counter incremented to ${_counter + 1}');
      _counter++;
    });
    debugPrint('Counter incremented to $_counter');
  }

  void _decrementCounter() {
    if (_counter == 0) {
      debugPrint('Counter is already at 0, cannot decrement further.');
      return;
    }

    setState(() {
      debugPrint('inside setState - Counter decremented to ${_counter - 1}');
      _counter--;
    });
    debugPrint('Counter decremented to $_counter');
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      appBar: AppBar(
        backgroundColor: Theme.of(context).colorScheme.inversePrimary,
        title: Text(widget.title),
      ),
      body: Center(
        child: Column(
          // making the x axis of the column to be centered, so that the children of the column 
          // are centered in the middle of the screen
          mainAxisAlignment: MainAxisAlignment.center,
          children: [
            const Text('You have pushed the button this many times:'),
            // same type of function as the Text widget, but with a different style
            Text(
              '$_counter',
              //  Theme.of(context) - access the current theme of the application
              style: Theme.of(context).textTheme.headlineMedium,
            ),
          ],
        ),
      ),
      // floating action button - a circular button that floats above the content of the screen
      // both button push to the end of the screen
      // every widgets can have children, but not all 
      // widgets can have multiple children. For example, 
      // a Row widget can have multiple children, but a Text 
      // widget can only have one child.
      floatingActionButton: Row(
        mainAxisAlignment: MainAxisAlignment.end,
        children: [
          FloatingActionButton(
            onPressed: _incrementCounter,
            tooltip: 'Increment',
            child: const Icon(Icons.add),
          ),
          // Add some space between the buttons
          const SizedBox(width: 16), 
          FloatingActionButton(
            onPressed: _decrementCounter,
            tooltip: 'Decrement',
            child: const Icon(Icons.remove),
          )
        ]
      )
    );
  }
}
