$(document).ready(function () {
    $("#userprofile").hide()
    $("#logincontainer").show()
    $("#logoutcontainer").hide()
    $("#admin").hide()

    axios.defaults.withCredentials = true;

    // check if user is logged in
    axios.post("http://localhost:8081/user/isloggedinRedis")
        .then(({ data }) => {
            if (data != null) {
                isLoggedIn = true;
                let { userid, type } = data
                $("#logincontainer").hide()
                $("#logoutcontainer").show()
                $("#admin").hide()
                $("#userprofile").show()
                if (type.toLowerCase() == "admin") {
                    $("#admin").show()
                }
            }
        })
        .catch((err) => {
            // if user is not loged in or if session expired
            localStorage.clear()
            $("#userprofile").hide()
            $("#logincontainer").show()
            $("#logoutcontainer").hide()
            $("#admin").hide()
            console.log("User not logged in:", err.response?.status);
        });

    $("#logout").click(function () {
        let cart = localStorage.getItem("Cart");
        
        // destroy session
        axios.post("http://localhost:8081/user/logout")
            .then(() => {
                // clear local storage
                localStorage.clear();
                if (cart) {
                    localStorage.setItem("Cart", cart);
                }
                // redirect to home page
                window.location.assign("http://localhost:3001/index.html");
            })
            .catch((err) => {
                console.error("Logout error:", err);
                // clear local storage even if logout fails
                localStorage.clear();
                if (cart) {
                    localStorage.setItem("Cart", cart);
                }
                window.location.assign("http://localhost:3001/index.html");
            });
        
        return false;
    });

});