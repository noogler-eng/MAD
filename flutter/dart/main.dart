// class definition
class Animal {
    String name;
    int age;

    // default constructor
    Animal(this.name, this.age);

    // named constructor - allows you to create multiple constructors for a class with different names
    Animal.baby(this.name) : age = 0;
    void speak() => print('$name says hello!');
}

// inheritance - Dog class inherits from Animal class
class Dog extends Animal {
    Dog(super.name, super.age);

    @override
    void speak() => print('$name barks!');
}


// async / await downstreams
// will make a network call, db queries, etc. and return a value after some time
Future<String> fetchUsername() async {
    await Future.delayed(Duration(seconds: 2));
    return "my_name";
}


Stream<int> countStream() async* {
    for (int i=1; i <= 5; i++ ){
        await Future.delayed(Duration(seconds: 1));
        // yield = "emit this value into the stream"
        yield i;
    }
}



// inline function, arrow syntax
int add(int a, int b) => a + b;

// optional positional - wrapped in [], can be omitted when calling the function
String greet(String name, [String? title]){
    return title != null ? 'Hello, $title $name!' : 'Hello, $name!';
}

// named parameters - wrapped in {}, called by name, order dones't matter, can be omitted when calling the function
// by adding value here, we can make the parameter default if not provided when calling the function
void createUser({required String name, required int age, String? email}){
    print('Creating user: $name, Age: $age, Email: ${email ?? 'Not provided'}');
}


void main() async {
    var name = 'my_name';
    var age = 25;

    final String greeting = 'Hello, $name! You are $age years old.';
    const pi = 3.14159;

    print(greeting);

    // ? checking nullability
    // ! bypassing the null check, crash on runtime
    // ?? default value if null
    int? score;
    print('Score: $score');

    score = 100;
    print('Score: $score');
    print('Score + 5: ${score! + 5}');

    String? nullableString = 'Hello, World!';
    print('Length of nullableString: ${nullableString?.length}');
    String? myName;
    print('Length of myName: ${myName?.length}');


    print(greet('Alice'));
    print(greet('Bob', 'Dr.'));

    createUser(name: 'Charlie', age: 30);
    createUser(name: 'Diana', age: 28, email: 'diana@example.com');
    createUser(age: 22, name: 'Eve', email: 'eve@example.com');


    Dog myDog = Dog('Buddy', 3);
    myDog.speak();

    Animal myAnimal = Animal('Generic Animal', 5);
    myAnimal.speak();

    // calling our constructor with named constructor
    Animal babyAnimal = Animal.baby('Baby Animal');
    babyAnimal.speak();

    // making an list of strings and iterating through it using a for loop
    List<String> fruits = ['Apple', 'Banana', 'Cherry'];
    for (var fruit in fruits) {
        print('Fruit: $fruit');
    }

    // spread operator - allows you to insert all the elements of a list into another list
    List <String> a = ['a', 'b', ...fruits, 'c'];
    print(a);

    // collection if - allows you to conditionally include elements in a collection
    bool includeFruits = true;
    List<String> b = ['x', 'y', if (includeFruits) ...fruits, 'z'];
    print(b);

    // iterating loops int the list using for loop
    List<int> squares = [
        for(var i=1; i<=5; i++) i*i,
    ];
    print(squares);


    // await pauses execution of this function only until the Future resolves — 
    // it does not block the whole app/UI thread. Other code (other widgets, 
    // other event handling) keeps running while this one function waits
    print('start');
    var username = await fetchUsername();
    print('Username: $username');
    print('end');

    // Streams — like a Future but for multiple values over time instead of one:
    print('start stream');
    await for (var value in countStream()){
        print('Stream value: $value');
    }
    print('end stream');
}