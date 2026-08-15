
// inline function, arrow syntax
int add(int a, int b) => a + b;

// optional positional - wrapped in [], can be omitted when calling the function
String greet(String name, [String? title]){
    return title != null ? 'Hello, $title $name!' : 'Hello, $name!';
}

// named parameters - wrapped in {}, called by name, order dones't matter, can be omitted when calling the function
void createUser({required String name, required int age, String? email}){
    print('Creating user: $name, Age: $age, Email: ${email ?? 'Not provided'}');
}


void main(){
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
}